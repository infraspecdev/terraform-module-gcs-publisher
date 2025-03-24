import { GCSService } from './services/gcs-service';
import { ModuleOptions } from './interfaces';
/**
 * Creates a zip archive of the module
 *
 * @param sourcePath - Path to the module to be archived
 * @param outputPath - Path where the archive will be created
 * @returns The path to the created archive
 */
declare function createZipArchive(sourcePath: string, outputPath: string): Promise<string>;
/**
 * Parses and validates all input parameters
 *
 * @returns Validated module options
 */
declare function getValidatedInputs(): ModuleOptions;
/**
 * Validates the input parameters
 *
 * @param options - Module options to validate
 */
declare function validateInputs(options: ModuleOptions): void;
/**
 * Creates a temporary file for Google credentials
 *
 * @param credentialsJson - Google credentials JSON string
 * @returns Path to the created credentials file
 */
declare function createTempCredentialsFile(credentialsJson: string): string;
/**
 * Processes the module upload and related operations
 *
 * @param options - Module options
 * @param gcsService - GCS service instance
 * @param zipFilePath - Path to the zip file to upload
 * @returns URL to the uploaded module
 */
declare function processModuleUpload(options: ModuleOptions, gcsService: GCSService, zipFilePath: string): Promise<string>;
/**
 * Main function that runs the action
 */
declare function run(): Promise<void>;
export { run, createZipArchive, getValidatedInputs, validateInputs, createTempCredentialsFile, processModuleUpload };
