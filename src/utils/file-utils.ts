/**
 * @fileoverview File utilities for the terraform-module-gcs-publisher.
 * This module provides file-related utility functions including calculating file hashes
 * for integrity verification when uploading Terraform modules to Google Cloud Storage.
 *
 * @author Infraspec
 * @license MIT
 */

import { createHash } from 'crypto'
import { createReadStream } from 'fs'

/**
 * Calculates SHA-256 hash of a file for integrity verification.
 * This function streams the file contents to calculate the hash,
 * which is more memory efficient than reading the entire file.
 *
 * @param filePath - Path to the file to be hashed
 * @returns A promise that resolves to the hex digest of the SHA-256 hash
 * @throws {Error} When the file cannot be read (e.g., file not found,
 *    permission issues, or other file system errors)
 */
export function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('error', (err) => reject(err))
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
