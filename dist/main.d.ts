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
import { GCSService } from './services/gcs-service';
import { ModuleOptions } from './interfaces';
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
declare function createZipArchive(sourcePath: string, outputPath: string): Promise<string>;
/**
 * Parses and validates all input parameters from the GitHub Actions environment.
 * This function extracts inputs using the @actions/core library and constructs
 * a validated ModuleOptions object ready for use in the module publishing process.
 *
 * @returns Validated module options object with all required properties set
 * @throws {Error} When required inputs are missing from the GitHub Actions context
 * @throws {Error} When inputs fail validation via the validateInputs function
 */
declare function getValidatedInputs(): ModuleOptions;
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
declare function validateInputs(options: ModuleOptions): void;
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
declare function createTempCredentialsFile(credentialsJson: string): string;
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
declare function processModuleUpload(options: ModuleOptions, gcsService: GCSService, zipFilePath: string): Promise<string>;
/**
 * Main function that runs the GitHub Action for publishing Terraform modules to GCS.
 * This is the entry point for the action that handles the entire process from reading
 * inputs, validating parameters, creating the zip archive, and uploading to GCS.
 *
 * @throws {Error} When required inputs are missing or invalid
 * @throws {Error} When zip creation fails due to file system issues
 * @throws {Error} When GCS authentication or upload operations fail
 */
declare function run(): Promise<void>;
export { run, createZipArchive, getValidatedInputs, validateInputs, createTempCredentialsFile, processModuleUpload };
