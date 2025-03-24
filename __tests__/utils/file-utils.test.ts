import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { calculateFileHash } from '../../src/utils/file-utils';

describe('File Utilities', () => {
  describe('calculateFileHash', () => {
    test('calculates file hash correctly', async () => {
      // Create a temporary test file
      const testFilePath = path.join(__dirname, 'test-file.txt');
      const testContent = 'test content for hash calculation';
      fs.writeFileSync(testFilePath, testContent);

      try {
        // Calculate hash with our function
        const calculatedHash = await calculateFileHash(testFilePath);
        
        // Calculate expected hash manually
        const expectedHash = crypto.createHash('sha256').update(testContent).digest('hex');
        
        // Compare
        expect(calculatedHash).toBe(expectedHash);
      } finally {
        // Clean up test file
        fs.unlinkSync(testFilePath);
      }
    });

    test('throws error for non-existent file', async () => {
      await expect(calculateFileHash('/path/to/nonexistent/file.txt')).rejects.toThrow();
    });
  });
});
