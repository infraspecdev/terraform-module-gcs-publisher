/**
 * @fileoverview Utility functions for validating input parameters.
 * This module provides validation functions for Google Cloud Storage bucket names
 * and Terraform module names to ensure they meet the required formatting rules.
 * These functions are used to verify user inputs before proceeding with operations.
 *
 * @author Infraspec
 * @license MIT
 */
/**
 * Validates a GCS bucket name according to Google Cloud Storage naming rules.
 *
 * @param name - The bucket name to validate (must be 3-63 characters, lowercase letters,
 *    numbers, hyphens, underscores, and periods only)
 * @returns The validated bucket name if valid
 * @throws {Error} When the bucket name doesn't conform to GCS bucket naming rules:
 *    - Must be 3-63 characters long
 *    - Can only contain lowercase letters, numbers, hyphens, underscores, and periods
 *    - Must start and end with a letter or number
 */
export declare function validateBucketName(name: string): string;
/**
 * Validates a Terraform module name to ensure it meets naming requirements.
 *
 * @param name - The module name to validate (must contain only letters, numbers,
 *    hyphens, and underscores)
 * @returns The validated module name if valid
 * @throws {Error} When the module name contains invalid characters. Only alphanumeric
 *    characters, hyphens, and underscores are permitted in module names.
 */
export declare function validateModuleName(name: string): string;
