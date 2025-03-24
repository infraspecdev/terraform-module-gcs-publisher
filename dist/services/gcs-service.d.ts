/**
 * @fileoverview Service for interacting with Google Cloud Storage (GCS).
 * This module provides functionality for uploading Terraform modules to GCS buckets,
 * managing metadata, and handling version cleanup operations. It abstracts all direct
 * interactions with the Google Cloud Storage API and provides a clean interface for
 * the main application logic.
 *
 * @author Infraspec
 * @license MIT
 */
/**
 * Handles interactions with Google Cloud Storage
 */
export declare class GCSService {
    private storage;
    /**
     * Creates a new GCS service instance
     *
     * @param credentialsFilePath - Path to the GCP credentials JSON file
     */
    constructor(credentialsFilePath: string);
    /**
     * Uploads a file to Google Cloud Storage with appropriate metadata.
     * This method handles the entire upload process including setting metadata,
     * making the file publicly accessible, and verifying the upload success.
     *
     * @param bucketName - Name of the GCS bucket where the file will be uploaded
     * @param filePath - Absolute local path to the file to upload
     * @param destination - Destination path within the bucket (e.g., 'modules/my-module/my-module-1.0.0.zip')
     * @param fileHash - SHA-256 hash of the file for integrity verification
     * @returns The public URL of the uploaded file (https://storage.googleapis.com/{bucket}/{path})
     * @throws {Error} When the bucket doesn't exist or authentication fails
     * @throws {Error} When the file at filePath cannot be read
     * @throws {Error} When the upload fails due to network issues
     * @throws {Error} When verification fails (uploaded file not found in bucket)
     */
    uploadToGCS(bucketName: string, filePath: string, destination: string, fileHash: string): Promise<string>;
    /**
     * Cleans up old versions of the module while keeping the specified number of recent versions.
     * This method retrieves all versions of a module, sorts them semantically,
     * and deletes older versions exceeding the keepVersions limit.
     *
     * @param bucketName - Name of the GCS bucket containing module versions
     * @param moduleFolder - Folder path in the bucket containing the module versions (e.g., 'modules/my-module')
     * @param moduleName - Name of the module used to identify version files
     * @param currentVersion - The current version being uploaded (will always be kept, not deleted)
     * @param keepVersions - Number of recent versions to keep (including current version)
     * @throws {Error} When the bucket doesn't exist or authentication fails
     * @throws {Error} When file listing or deletion operations fail
     * @throws {Error} When there are problems parsing version numbers
     */
    cleanupOldVersions(bucketName: string, moduleFolder: string, moduleName: string, currentVersion: string, keepVersions: number): Promise<void>;
}
