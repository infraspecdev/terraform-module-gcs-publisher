// Import dependencies first but not the module we're testing yet
// We need to set up our mocks before importing the module under test
// Removing unused fs and path imports as they're not used in the tests
import * as coreModule from '@actions/core';

// Create mock implementations for GCS services
const mockDelete = jest.fn().mockResolvedValue([{}]);
const mockExists = jest.fn().mockResolvedValue([true]);
const mockMakePublic = jest.fn().mockResolvedValue([{}]);
const mockUpload = jest.fn().mockResolvedValue([{
  name: 'test-file.zip',
  metadata: { md5Hash: 'test-hash' }
}]);

// Create mock file objects
const mockFiles = [
  { 
    name: 'modules/test-module/test-module-1.0.0.zip', 
    metadata: {}, 
    delete: mockDelete 
  },
  { 
    name: 'modules/test-module/test-module-0.9.0.zip', 
    metadata: {}, 
    delete: mockDelete 
  },
  { 
    name: 'modules/test-module/test-module-0.8.0.zip', 
    metadata: {}, 
    delete: mockDelete 
  },
  { 
    name: 'modules/test-module/test-module-0.7.0.zip', 
    metadata: {}, 
    delete: mockDelete 
  }
];

// Mock the entire Storage class
const mockFile = jest.fn().mockImplementation(() => ({
  delete: mockDelete,
  exists: mockExists,
  makePublic: mockMakePublic
}));

const mockBucket = jest.fn().mockImplementation(() => ({
  upload: mockUpload,
  file: mockFile,
  getFiles: jest.fn().mockResolvedValue([mockFiles])
}));

const mockStorage = jest.fn().mockImplementation(() => ({
  bucket: mockBucket
}));

// Mock @google-cloud/storage
jest.mock('@google-cloud/storage', () => ({
  Storage: mockStorage
}));

// Mock @actions/core for logging
jest.mock('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn()
}));

// Import the module under test AFTER setting up all mocks
import { GCSService } from '../../src/services/gcs-service';

describe('GCSService', () => {
  let gcsService: GCSService;
  const credentialsPath = '/path/to/credentials.json';
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new instance before each test
    gcsService = new GCSService(credentialsPath);
  });
  
  describe('uploadToGCS', () => {
    test('uploads file to GCS successfully', async () => {
      // Setup
      const bucketName = 'test-bucket';
      const filePath = '/path/to/local/file.zip';
      const destination = 'modules/test-module/test-module-1.0.0.zip';
      const fileHash = 'abc123hash';
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Call the function
      const result = await gcsService.uploadToGCS(bucketName, filePath, destination, fileHash);
      
      // Verify the result is the expected URL
      expect(result).toBe(`https://storage.googleapis.com/${bucketName}/${destination}`);
      
      // Check that our mocks were called with the right parameters
      expect(mockStorage().bucket).toHaveBeenCalledWith(bucketName);
      expect(mockUpload).toHaveBeenCalledWith(filePath, expect.objectContaining({
        destination,
        metadata: expect.objectContaining({
          contentType: 'application/zip',
          metadata: expect.objectContaining({
            sha256Hash: fileHash
          })
        })
      }));
      
      expect(mockExists).toHaveBeenCalled();
      expect(mockMakePublic).toHaveBeenCalled();
    });
    
    test('throws error if upload verification fails', async () => {
      // Setup
      const bucketName = 'test-bucket';
      const filePath = '/path/to/local/file.zip';
      const destination = 'modules/test-module/test-module-1.0.0.zip';
      const fileHash = 'abc123hash';
      
      // Reset mocks
      jest.clearAllMocks();
      
      // Mock file.exists to return false (file not found after upload)
      mockExists.mockResolvedValueOnce([false]);
      
      // Expect the function to throw an error
      await expect(
        gcsService.uploadToGCS(bucketName, filePath, destination, fileHash)
      ).rejects.toThrow(/upload verification failed/i);
    });
  });
  
  describe('cleanupOldVersions', () => {
    test('deletes old versions while keeping the specified number', async () => {
      // Setup
      const bucketName = 'test-bucket';
      const moduleFolder = 'modules/test-module';
      const moduleName = 'test-module';
      const currentVersion = '1.0.0';
      const keepVersions = 2; // Keep current and one old version
      
      // Reset mocks
      jest.clearAllMocks();
      mockDelete.mockClear();
      
      // Call the function
      await gcsService.cleanupOldVersions(bucketName, moduleFolder, moduleName, currentVersion, keepVersions);
      
      // Verify bucket was retrieved correctly
      expect(mockStorage().bucket).toHaveBeenCalledWith(bucketName);
      
      // We expect delete to be called for the oldest files (0.8.0 and 0.7.0)
      // Since we're keeping current (1.0.0) and one old version (0.9.0)
      expect(mockDelete).toHaveBeenCalled();
      
      // Verify the core.info was called for deletions
      expect(coreModule.info).toHaveBeenCalledWith(expect.stringContaining('Deleting old version'));
    });
    
    test('does not delete files if keepVersions is higher than available versions', async () => {
      // Setup
      const bucketName = 'test-bucket';
      const moduleFolder = 'modules/test-module';
      const moduleName = 'test-module';
      const currentVersion = '1.0.0';
      const keepVersions = 10; // More than the available versions
      
      // Reset mocks and counters
      jest.clearAllMocks();
      
      // Call the function
      await gcsService.cleanupOldVersions(bucketName, moduleFolder, moduleName, currentVersion, keepVersions);
      
      // Verify bucket was called
      expect(mockStorage().bucket).toHaveBeenCalledWith(bucketName);
      
      // No files should be deleted when keepVersions is higher than available versions
      expect(mockDelete).not.toHaveBeenCalled();
      
      // Verify no deletion messages were logged
      expect(coreModule.info).not.toHaveBeenCalledWith(expect.stringContaining('Deleting old version'));
    });
  });
});
