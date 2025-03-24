/**
 * Interface for Google Cloud Storage bucket upload options
 */
export interface GCSBucketOptions {
    destination: string;
    metadata: {
        contentType: string;
        cacheControl: string;
        metadata: {
            sha256Hash: string;
            uploadedBy: string;
            uploadTimestamp: string;
        };
    };
    validation: string;
    resumable: boolean;
}
/**
 * Interface for module publishing options
 */
export interface ModuleOptions {
    bucketName: string;
    moduleName: string;
    moduleVersion: string;
    modulePath: string;
    googleCredentialsJson: string;
    deleteOldVersions: boolean;
    keepVersions: number;
}
