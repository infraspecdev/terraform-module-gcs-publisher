/**
 * Validates a GCS bucket name according to naming rules
 * @param name - The bucket name to validate
 * @returns The validated bucket name
 * @throws Error if the bucket name is invalid
 */
export declare function validateBucketName(name: string): string;
/**
 * Validates a module name
 * @param name - The module name to validate
 * @returns The validated module name
 * @throws Error if the module name is invalid
 */
export declare function validateModuleName(name: string): string;
/**
 * Calculates SHA-256 hash of a file
 * @param filePath - Path to the file
 * @returns A promise that resolves to the hex digest of the hash
 */
export declare function calculateFileHash(filePath: string): Promise<string>;
