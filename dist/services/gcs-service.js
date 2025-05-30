"use strict";
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
exports.GCSService = void 0;
const storage_1 = require("@google-cloud/storage");
const core = __importStar(require("@actions/core"));
const semver = __importStar(require("semver"));
/**
 * Handles interactions with Google Cloud Storage
 */
class GCSService {
    /**
     * Creates a new GCS service instance
     *
     * @param credentialsFilePath - Path to the GCP credentials JSON file
     */
    constructor(credentialsFilePath) {
        this.storage = new storage_1.Storage({
            keyFilename: credentialsFilePath
        });
    }
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
    async uploadToGCS(bucketName, filePath, destination, fileHash) {
        const bucket = this.storage.bucket(bucketName);
        const options = {
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
            resumable: false
        };
        core.info(`Uploading to: ${destination}`);
        await bucket.upload(filePath, options);
        // Make the file publicly accessible
        await bucket.file(destination).makePublic();
        // Verify the upload was successful
        const [exists] = await bucket.file(destination).exists();
        if (!exists) {
            throw new Error(`Upload verification failed: File ${destination} not found in bucket after upload`);
        }
        return `https://storage.googleapis.com/${bucketName}/${destination}`;
    }
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
    async cleanupOldVersions(bucketName, moduleFolder, moduleName, currentVersion, keepVersions) {
        const bucket = this.storage.bucket(bucketName);
        // Get all versions
        const [files] = await bucket.getFiles({
            prefix: moduleFolder
        });
        // Filter to just the version files for this module and parse their versions
        const versionFiles = [];
        const moduleFileRegex = new RegExp(`^${moduleFolder}/${moduleName}-(\\d+\\.\\d+\\.\\d+)\\.zip$`);
        for (const file of files) {
            const match = file.name.match(moduleFileRegex);
            if (match && match[1]) {
                const version = match[1];
                // Skip the current version being uploaded
                if (version !== currentVersion) {
                    versionFiles.push({
                        file,
                        version
                    });
                }
            }
        }
        // If we don't have more versions than we want to keep, don't delete any
        if (versionFiles.length <= keepVersions) {
            core.info(`No old versions to clean up (keeping ${keepVersions}, found ${versionFiles.length})`);
            return;
        }
        // Sort by semver (newest first)
        versionFiles.sort((a, b) => {
            return semver.compare(b.version, a.version);
        });
        // Keep the newest N versions, delete the rest
        const versionsToDelete = versionFiles.slice(keepVersions);
        core.info(`Cleaning up ${versionsToDelete.length} old version(s)...`);
        for (const versionFile of versionsToDelete) {
            core.info(`Deleting old version: ${versionFile.file.name}`);
            await versionFile.file.delete();
        }
        core.info(`Successfully cleaned up old versions, keeping the ${keepVersions} most recent.`);
    }
}
exports.GCSService = GCSService;
//# sourceMappingURL=gcs-service.js.map