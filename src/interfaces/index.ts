/**
 * @fileoverview Type definitions and interfaces for the terraform-module-gcs-publisher.
 * This module contains TypeScript interfaces that define the structure for module options,
 * GCS bucket options, and other data structures used throughout the application.
 * 
 * @author Infraspec
 * @license MIT
 */

/**
 * Interface for Google Cloud Storage bucket upload options.
 * These options are used when uploading files to a GCS bucket.
 */
export interface GCSBucketOptions {
  /** Destination path within the bucket where the file will be stored */
  destination: string;
  /** Metadata to associate with the uploaded file */
  metadata: {
    /** MIME type of the file, typically 'application/zip' for module archives */
    contentType: string;
    /** Cache control header, affects how the file is cached by browsers and CDNs */
    cacheControl: string;
    /** Custom metadata fields that provide additional information about the file */
    metadata: {
      /** SHA-256 hash of the file for integrity verification */
      sha256Hash: string;
      /** Identifier for the uploader, typically the action name */
      uploadedBy: string;
      /** ISO timestamp when the upload occurred */
      uploadTimestamp: string;
    }
  };
  /** Validation method to use during upload (e.g., 'crc32c') */
  validation: string;
  /** Whether to use resumable uploads, typically set to false for smaller files */
  resumable: boolean;
}

/**
 * Interface for module publishing options.
 * These options control how a Terraform module is published to GCS.
 */
export interface ModuleOptions {
  /** Name of the GCS bucket to upload to (must follow GCS naming rules) */
  bucketName: string;
  /** Name of the Terraform module (used in path construction and file naming) */
  moduleName: string;
  /** Semantic version of the module (e.g., '1.0.0') */
  moduleVersion: string;
  /** Local filesystem path to the module directory */
  modulePath: string;
  /** Google Cloud credentials JSON content for authentication */
  googleCredentialsJson: string;
  /** Whether to delete older versions of the same module */
  deleteOldVersions: boolean;
  /** Number of recent versions to retain when cleaning up old versions */
  keepVersions: number;
}
