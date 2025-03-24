/**
 * @fileoverview Main entry point for the terraform-module-gcs-publisher GitHub Action.
 * This module handles publishing Terraform modules to Google Cloud Storage with proper
 * versioning, metadata, and cleanup of old versions. It implements the core functionality
 * required by the action including input validation, file handling, GCS uploads, and
 * version management.
 * 
 * @author Infraspec
 * @license MIT
 */

import * as core from '@actions/core';
import * as path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import { GCSService } from './services/gcs-service';
import { ModuleOptions } from './interfaces';
import { validateBucketName, validateModuleName } from './utils/validation';
import { calculateFileHash } from './utils/file-utils';

/**
 * Creates a zip archive of the module for uploading to Google Cloud Storage.
 * This function uses the system's zip command to create an archive while excluding
 * git-related files and other unnecessary metadata files.
 * 
 * @param sourcePath - Path to the module directory to be archived
 * @param outputPath - Path where the zip archive will be created
 * @returns The path to the created zip archive
 * @throws {Error} When the source path doesn't exist or isn't accessible
 * @throws {Error} When the zip command fails to execute properly
 * @throws {Error} When the output zip file cannot be created or verified
 */
async function createZipArchive(sourcePath: string, outputPath: string): Promise<string> {
  // Ensure the source path exists
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source path ${sourcePath} does not exist`);
  }
  
  // Create zip archive using zip command
  const zipArgs = ['-r', outputPath, '.', '-x', '*.git*', '*.DS_Store'];
  const options = {
    cwd: sourcePath,
    silent: true
  };
  
  // Import exec dynamically to avoid including all dependencies at top level
  const exec = await import('@actions/exec');
  await exec.exec('zip', zipArgs, options);
  
  // Verify the zip file was created
  if (!fs.existsSync(outputPath)) {
    throw new Error(`Failed to create zip file at ${outputPath}`);
  }
  
  return outputPath;
}

/**
 * Parses and validates all input parameters from the GitHub Actions environment.
 * This function extracts inputs using the @actions/core library and constructs
 * a validated ModuleOptions object ready for use in the module publishing process.
 * 
 * @returns Validated module options object with all required properties set
 * @throws {Error} When required inputs are missing from the GitHub Actions context
 * @throws {Error} When inputs fail validation via the validateInputs function
 */
function getValidatedInputs(): ModuleOptions {
  const options: ModuleOptions = {
    bucketName: core.getInput('gcs-bucket', { required: true }),
    moduleName: core.getInput('module-name', { required: true }),
    moduleVersion: core.getInput('module-version', { required: true }),
    modulePath: core.getInput('module-path', { required: true }),
    googleCredentialsJson: core.getInput('google-credentials', { required: true }),
    deleteOldVersions: core.getInput('delete-old-versions') === 'true',
    keepVersions: parseInt(core.getInput('keep-versions') || '5', 10)
  };
  
  validateInputs(options);
  
  return options;
}

/**
 * Validates the input parameters to the GitHub Action.
 * This function performs comprehensive validation on all input parameters including
 * format validation, existence checks, and semantic version validation.
 * 
 * @param options - Module options object containing all parameters to validate
 * @throws {Error} When the bucket name doesn't conform to GCS naming rules
 * @throws {Error} When the module name contains invalid characters
 * @throws {Error} When the module path doesn't exist on the filesystem
 * @throws {Error} When the module version isn't a valid semantic version format
 * @throws {Error} When the keepVersions parameter is not a positive integer
 */
function validateInputs(options: ModuleOptions): void {
  // Validate bucket name format
  validateBucketName(options.bucketName);
  
  // Validate module name format
  validateModuleName(options.moduleName);
  
  // Validate module path exists
  if (!fs.existsSync(options.modulePath)) {
    throw new Error(`Module path ${options.modulePath} does not exist`);
  }
  
  // Validate module version is a valid semver
  if (!semver.valid(options.moduleVersion)) {
    throw new Error(`Invalid module version: ${options.moduleVersion}. Must be a valid semantic version.`);
  }
  
  // Validate keep-versions is a positive integer
  if (options.keepVersions <= 0) {
    throw new Error(`Invalid keep-versions value: ${options.keepVersions}. Must be a positive integer.`);
  }
}

/**
 * Creates a temporary file for Google credentials.
 * This function validates the JSON format of the credentials and writes them to a
 * temporary file that can be used by the Google Cloud Storage client library.
 * 
 * @param credentialsJson - Google credentials JSON string containing service account information
 * @returns Path to the created temporary credentials file
 * @throws {Error} When the credentials JSON is invalid or cannot be parsed
 * @throws {Error} When the temporary file cannot be created due to file system errors
 */
function createTempCredentialsFile(credentialsJson: string): string {
  // Create a temporary credentials file
  const tempDir = process.env.RUNNER_TEMP || '/tmp';
  const credentialsPath = path.join(tempDir, 'google-credentials.json');
  
  try {
    // Validate JSON format
    JSON.parse(credentialsJson);
    
    // Write credentials to file
    fs.writeFileSync(credentialsPath, credentialsJson, { encoding: 'utf8' });
    core.info(`Created temporary credentials file at ${credentialsPath}`);
    
    return credentialsPath;
  } catch (error) {
    throw new Error(`Invalid Google credentials JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Processes the module upload and related operations.
 * This function calculates the file hash, performs the upload operation,
 * and handles cleanup of old versions if requested in the options.
 * 
 * @param options - Module options containing bucket name, module name, and version information
 * @param gcsService - GCS service instance for interacting with Google Cloud Storage
 * @param zipFilePath - Path to the local zip file to be uploaded
 * @returns URL to the uploaded module in Google Cloud Storage (gs:// format)
 * @throws {Error} When file hash calculation fails due to file system errors
 * @throws {Error} When the upload to GCS fails due to authentication or network issues
 * @throws {Error} When cleanup of old versions fails (if deleteOldVersions is true)
 */
async function processModuleUpload(
  options: ModuleOptions, 
  gcsService: GCSService, 
  zipFilePath: string
): Promise<string> {
  // Calculate file hash for integrity verification
  const fileHash = await calculateFileHash(zipFilePath);
  core.info(`File integrity hash (SHA-256): ${fileHash}`);
  
  // Determine module folder structure
  const moduleFolder = `modules/${options.moduleName}`;
  const zipFileName = `${options.moduleName}-${options.moduleVersion}.zip`;
  
  // Upload versioned file with hash metadata
  await gcsService.uploadToGCS(
    options.bucketName,
    zipFilePath,
    `${moduleFolder}/${zipFileName}`,
    fileHash
  );
  
  // Clean up old versions if requested
  if (options.deleteOldVersions) {
    await gcsService.cleanupOldVersions(
      options.bucketName,
      moduleFolder,
      options.moduleName,
      options.moduleVersion,
      options.keepVersions
    );
  }
  
  return `gs://${options.bucketName}/${moduleFolder}/${zipFileName}`;
}

/**
 * Main function that runs the GitHub Action for publishing Terraform modules to GCS.
 * This is the entry point for the action that handles the entire process from reading
 * inputs, validating parameters, creating the zip archive, and uploading to GCS.
 * 
 * @throws {Error} When required inputs are missing or invalid
 * @throws {Error} When zip creation fails due to file system issues
 * @throws {Error} When GCS authentication or upload operations fail
 */
async function run(): Promise<void> {
  let tempCredentialsFile: string | null = null;
  
  try {
    // Get and validate inputs
    const options = getValidatedInputs();
    
    // Create temporary credentials file
    tempCredentialsFile = createTempCredentialsFile(options.googleCredentialsJson);
    
    // Initialize GCS service
    const gcsService = new GCSService(tempCredentialsFile);
    
    // Prepare zip file
    const zipFileName = `${options.moduleName}-${options.moduleVersion}.zip`;
    const zipFilePath = path.join(process.env.RUNNER_TEMP || '/tmp', zipFileName);
    
    // Create zip file
    core.info(`Creating zip file for module ${options.moduleName} v${options.moduleVersion}...`);
    await createZipArchive(options.modulePath, zipFilePath);
    
    // Upload to GCS and process related operations
    core.info(`Uploading ${zipFileName} to GCS bucket ${options.bucketName}...`);
    const moduleUrl = await processModuleUpload(options, gcsService, zipFilePath);
    
    // Set outputs
    core.setOutput('module-url', moduleUrl);
    core.setOutput('version', options.moduleVersion);
    
    core.info(`✅ Successfully published module to ${moduleUrl}`);
  } catch (error) {
    // Improved error handling as per GitHub template
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`Unexpected error: ${error}`);
    }
  } finally {
    // Clean up credentials file
    if (tempCredentialsFile && fs.existsSync(tempCredentialsFile)) {
      fs.unlinkSync(tempCredentialsFile);
    }
  }
}

// Run the action
if (require.main === module) {
  // This check ensures the function is executed only when this file is run directly
  run();
}

// Export for testing purposes
export { run, createZipArchive, getValidatedInputs, validateInputs, createTempCredentialsFile, processModuleUpload };
