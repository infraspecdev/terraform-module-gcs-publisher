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
     * Uploads a file to Google Cloud Storage
     *
     * @param bucketName - Name of the GCS bucket
     * @param filePath - Local path to the file to upload
     * @param destination - Destination path in the bucket
     * @param fileHash - SHA-256 hash of the file for integrity verification
     * @returns The public URL of the uploaded file
     */
    uploadToGCS(bucketName: string, filePath: string, destination: string, fileHash: string): Promise<string>;
    /**
     * Cleans up old versions of the module while keeping the specified number of recent versions
     *
     * @param bucketName - Name of the GCS bucket
     * @param moduleFolder - Folder path in the bucket containing the module versions
     * @param moduleName - Name of the module
     * @param currentVersion - The current version being uploaded (will not be deleted)
     * @param keepVersions - Number of recent versions to keep
     */
    cleanupOldVersions(bucketName: string, moduleFolder: string, moduleName: string, currentVersion: string, keepVersions: number): Promise<void>;
}
