"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
exports.createZipArchive = createZipArchive;
exports.getValidatedInputs = getValidatedInputs;
exports.validateInputs = validateInputs;
exports.createTempCredentialsFile = createTempCredentialsFile;
exports.processModuleUpload = processModuleUpload;
const core = __importStar(require("@actions/core"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const semver = __importStar(require("semver"));
const gcs_service_1 = require("./services/gcs-service");
const validation_1 = require("./utils/validation");
/**
 * Creates a zip archive of the module
 *
 * @param sourcePath - Path to the module to be archived
 * @param outputPath - Path where the archive will be created
 * @returns The path to the created archive
 */
async function createZipArchive(sourcePath, outputPath) {
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
    const exec = await Promise.resolve().then(() => __importStar(require('@actions/exec')));
    await exec.exec('zip', zipArgs, options);
    // Verify the zip file was created
    if (!fs.existsSync(outputPath)) {
        throw new Error(`Failed to create zip file at ${outputPath}`);
    }
    return outputPath;
}
/**
 * Parses and validates all input parameters
 *
 * @returns Validated module options
 */
function getValidatedInputs() {
    const options = {
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
 * Validates the input parameters
 *
 * @param options - Module options to validate
 */
function validateInputs(options) {
    // Validate bucket name format
    (0, validation_1.validateBucketName)(options.bucketName);
    // Validate module name format
    (0, validation_1.validateModuleName)(options.moduleName);
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
 * Creates a temporary file for Google credentials
 *
 * @param credentialsJson - Google credentials JSON string
 * @returns Path to the created credentials file
 */
function createTempCredentialsFile(credentialsJson) {
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
    }
    catch (error) {
        throw new Error(`Invalid Google credentials JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Processes the module upload and related operations
 *
 * @param options - Module options
 * @param gcsService - GCS service instance
 * @param zipFilePath - Path to the zip file to upload
 * @returns URL to the uploaded module
 */
async function processModuleUpload(options, gcsService, zipFilePath) {
    // Calculate file hash for integrity verification
    const fileHash = await (0, validation_1.calculateFileHash)(zipFilePath);
    core.info(`File integrity hash (SHA-256): ${fileHash}`);
    // Determine module folder structure
    const moduleFolder = `modules/${options.moduleName}`;
    const zipFileName = `${options.moduleName}-${options.moduleVersion}.zip`;
    // Upload versioned file with hash metadata
    await gcsService.uploadToGCS(options.bucketName, zipFilePath, `${moduleFolder}/${zipFileName}`, fileHash);
    // Clean up old versions if requested
    if (options.deleteOldVersions) {
        await gcsService.cleanupOldVersions(options.bucketName, moduleFolder, options.moduleName, options.moduleVersion, options.keepVersions);
    }
    return `gs://${options.bucketName}/${moduleFolder}/${zipFileName}`;
}
/**
 * Main function that runs the action
 */
async function run() {
    let tempCredentialsFile = null;
    try {
        // Get and validate inputs
        const options = getValidatedInputs();
        // Create temporary credentials file
        tempCredentialsFile = createTempCredentialsFile(options.googleCredentialsJson);
        // Initialize GCS service
        const gcsService = new gcs_service_1.GCSService(tempCredentialsFile);
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
    }
    catch (error) {
        // Improved error handling as per GitHub template
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed(`Unexpected error: ${error}`);
        }
    }
    finally {
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
//# sourceMappingURL=main.js.map