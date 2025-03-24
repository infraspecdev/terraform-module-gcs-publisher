"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBucketName = validateBucketName;
exports.validateModuleName = validateModuleName;
exports.calculateFileHash = calculateFileHash;
const crypto_1 = require("crypto");
const fs_1 = require("fs");
/**
 * Validates a GCS bucket name according to naming rules
 * @param name - The bucket name to validate
 * @returns The validated bucket name
 * @throws Error if the bucket name is invalid
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
 * Validates a module name
 * @param name - The module name to validate
 * @returns The validated module name
 * @throws Error if the module name is invalid
 */
function validateModuleName(name) {
    // Only allow alphanumeric chars, hyphens, and underscores
    const moduleNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!moduleNameRegex.test(name)) {
        throw new Error(`Invalid module name: ${name}. Only letters, numbers, hyphens, and underscores are allowed.`);
    }
    return name;
}
/**
 * Calculates SHA-256 hash of a file
 * @param filePath - Path to the file
 * @returns A promise that resolves to the hex digest of the hash
 */
function calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const hash = (0, crypto_1.createHash)('sha256');
        const stream = (0, fs_1.createReadStream)(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}
//# sourceMappingURL=validation.js.map