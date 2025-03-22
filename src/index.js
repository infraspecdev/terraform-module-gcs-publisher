const core = require('@actions/core');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');
const exec = require('@actions/exec');
const semver = require('semver');
const crypto = require('crypto');

// Security helpers
function validateBucketName(name) {
  // GCS bucket naming rules: 3-63 chars, lowercase, numbers, hyphens, underscores, periods
  const bucketRegex = /^[a-z0-9][a-z0-9_.-]{1,61}[a-z0-9]$/;
  if (!bucketRegex.test(name)) {
    throw new Error(`Invalid bucket name: ${name}. Must be 3-63 characters, lowercase, and can only contain letters, numbers, hyphens, underscores, and periods.`);
  }
  return name;
}

function validateModuleName(name) {
  // Only allow alphanumeric chars, hyphens, and underscores
  const moduleNameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!moduleNameRegex.test(name)) {
    throw new Error(`Invalid module name: ${name}. Only letters, numbers, hyphens, and underscores are allowed.`);
  }
  return name;
}

function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function run() {
  try {
    // Get inputs with validation
    const bucketName = validateBucketName(core.getInput('gcs-bucket', { required: true }));
    const moduleName = validateModuleName(core.getInput('module-name', { required: true }));
    const moduleVersion = core.getInput('module-version', { required: true });
    const modulePath = path.resolve(core.getInput('module-path', { required: true }));
    const googleCredentialsJson = core.getInput('google-credentials', { required: true });
    const deleteOldVersions = core.getInput('delete-old-versions') === 'true';
    const keepVersions = Math.max(1, Math.min(parseInt(core.getInput('keep-versions'), 10) || 5, 100));

    // Validate semver
    if (!semver.valid(moduleVersion)) {
      throw new Error(`Invalid version format: ${moduleVersion}. Please use semver format (e.g., 1.0.0).`);
    }

    // Validate module path exists
    if (!fs.existsSync(modulePath)) {
      throw new Error(`Module path does not exist: ${modulePath}`);
    }

    // Parse Google credentials to validate JSON format
    try {
      JSON.parse(googleCredentialsJson);
    } catch (error) {
      throw new Error(`Failed to parse Google credentials: ${error.message}`);
    }

    // Create temporary credentials file for GCS authentication
    // Create temporary credentials file with more secure random name
    const randomId = crypto.randomBytes(16).toString('hex');
    const tempDir = process.env.RUNNER_TEMP || '/tmp';
    const tempCredentialsFile = path.join(tempDir, `gcp-creds-${randomId}.json`);
    
    // Ensure temp directory permissions are secure
    try {
      fs.chmodSync(tempDir, 0o700);
    } catch (error) {
      core.warning(`Unable to secure temp directory permissions: ${error.message}`);
    }
    
    try {
      // Write credentials with restricted permissions
      fs.writeFileSync(tempCredentialsFile, googleCredentialsJson, { mode: 0o600 });
      
      // Setup GCS client
      const storage = new Storage({
        keyFilename: tempCredentialsFile
      });
      
      // Prepare zip file name
      const zipFileName = `${moduleName}-${moduleVersion}.zip`;
      const zipFilePath = path.join(process.env.RUNNER_TEMP || '/tmp', zipFileName);
      
      // Create zip file
      core.info(`Creating zip file for module ${moduleName} v${moduleVersion}...`);
      await createZipArchive(modulePath, zipFilePath);
      
      // Upload to GCS
      core.info(`Uploading ${zipFileName} to GCS bucket ${bucketName}...`);
      const moduleFolder = `modules/${moduleName}`;
      
      // Calculate file hash before uploading
      const fileHash = await calculateFileHash(zipFilePath);
      core.info(`File integrity hash (SHA-256): ${fileHash}`);
      
      // Upload versioned file with hash metadata
      await uploadToGCS(storage, bucketName, zipFilePath, `${moduleFolder}/${zipFileName}`, fileHash);
      
      // Clean up old versions if requested
      if (deleteOldVersions) {
        await cleanupOldVersions(storage, bucketName, moduleFolder, moduleName, moduleVersion, keepVersions);
      }
      
      // Set outputs
      const moduleUrl = `gs://${bucketName}/${moduleFolder}/${zipFileName}`;
      core.setOutput('module-url', moduleUrl);
      core.setOutput('version', moduleVersion);
      
      core.info(`✅ Successfully published module to ${moduleUrl}`);
    } finally {
      // Clean up credentials file
      if (fs.existsSync(tempCredentialsFile)) {
        fs.unlinkSync(tempCredentialsFile);
      }
    }
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

async function createZipArchive(sourcePath, outputPath) {
  const options = {
    silent: true
  };
  
  // Use zip command for better control and security
  await exec.exec('zip', ['-r', outputPath, '.'], {
    cwd: sourcePath,
    ...options
  });
  
  // Verify the zip was created successfully
  if (!fs.existsSync(outputPath)) {
    throw new Error('Failed to create zip archive');
  }
  
  core.info(`Created zip archive at ${outputPath}`);
  return outputPath;
}

async function uploadToGCS(storage, bucketName, filePath, destination, fileHash) {
  const bucket = storage.bucket(bucketName);
  
  // Upload with appropriate options and integrity metadata
  await bucket.upload(filePath, {
    destination,
    metadata: {
      contentType: 'application/zip',
      cacheControl: 'public, max-age=31536000',
      metadata: {
        sha256Hash: fileHash,
        uploadedBy: 'terraform-module-gcs-publisher-action',
        uploadTimestamp: new Date().toISOString()
      }
    },
    validation: 'crc32c',
    resumable: false // More secure for smaller files
  });
  
  // Make the object publicly accessible with proper Content-Type
  await bucket.file(destination).makePublic();
  
  // Verify the upload was successful by checking if the file exists
  const [exists] = await bucket.file(destination).exists();
  if (!exists) {
    throw new Error(`Upload verification failed: File ${destination} not found in bucket after upload`);
  }
  
  core.info(`Successfully uploaded file to gs://${bucketName}/${destination}`);
  return `https://storage.googleapis.com/${bucketName}/${destination}`;
}

async function cleanupOldVersions(storage, bucketName, moduleFolder, moduleName, currentVersion, keepVersions) {
  const bucket = storage.bucket(bucketName);
  const prefix = `${moduleFolder}/${moduleName}-`;
  
  // List all versions
  const [files] = await bucket.getFiles({ prefix });
  
  // Filter to only get version files (not latest.zip)
  const versionFiles = files.filter(file => {
    const fileName = path.basename(file.name);
    return fileName.startsWith(`${moduleName}-`) && 
           fileName !== `${moduleName}-latest.zip` &&
           fileName.endsWith('.zip');
  });
  
  // Extract versions and sort
  const versions = versionFiles.map(file => {
    const fileName = path.basename(file.name);
    // Extract version from filename (e.g., module-name-1.2.3.zip -> 1.2.3)
    const versionMatch = fileName.match(new RegExp(`${moduleName}-(.*).zip`));
    return {
      file,
      version: versionMatch ? versionMatch[1] : null
    };
  })
  .filter(item => item.version && semver.valid(item.version))
  .sort((a, b) => semver.compare(b.version, a.version)); // Sort descending
  
  // Keep the current version plus the N most recent versions
  const versionsToDelete = versions
    .filter(item => semver.lt(item.version, currentVersion)) // Only delete older versions
    .slice(keepVersions - 1); // Keep the N most recent (subtract 1 because we're already keeping current)
  
  if (versionsToDelete.length > 0) {
    core.info(`Deleting ${versionsToDelete.length} old versions...`);
    
    for (const item of versionsToDelete) {
      await item.file.delete();
      core.info(`Deleted old version: ${item.version}`);
    }
  } else {
    core.info('No old versions to delete');
  }
}

run();
