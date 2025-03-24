"use strict";
/**
 * @fileoverview Utility functions for validating input parameters.
 * This module provides validation functions for Google Cloud Storage bucket names
 * and Terraform module names to ensure they meet the required formatting rules.
 * These functions are used to verify user inputs before proceeding with operations.
 *
 * @author Infraspec
 * @license MIT
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBucketName = validateBucketName;
exports.validateModuleName = validateModuleName;
// No imports needed for validation functions
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
function validateBucketName(name) {
    // GCS bucket naming rules: 3-63 chars, lowercase, numbers, hyphens, underscores, periods
    const bucketRegex = /^[a-z0-9][a-z0-9_.-]{1,61}[a-z0-9]$/;
    if (!bucketRegex.test(name)) {
        throw new Error(`Invalid bucket name: ${name}. Must be 3-63 characters, lowercase, and can only contain letters, numbers, hyphens, underscores, and periods.`);
    }
    return name;
}
/**
 * Validates a Terraform module name to ensure it meets naming requirements.
 *
 * @param name - The module name to validate (must contain only letters, numbers,
 *    hyphens, and underscores)
 * @returns The validated module name if valid
 * @throws {Error} When the module name contains invalid characters. Only alphanumeric
 *    characters, hyphens, and underscores are permitted in module names.
 */
function validateModuleName(name) {
    // Only allow alphanumeric chars, hyphens, and underscores
    const moduleNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!moduleNameRegex.test(name)) {
        throw new Error(`Invalid module name: ${name}. Only letters, numbers, hyphens, and underscores are allowed.`);
    }
    return name;
}
//# sourceMappingURL=validation.js.map