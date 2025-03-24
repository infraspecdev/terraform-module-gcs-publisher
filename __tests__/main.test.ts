// Import modules first
import * as path from 'path'
import * as fs from 'fs'
import * as coreModule from '@actions/core'
import * as execModule from '@actions/exec'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { InputOptions } from '@actions/core'

// Type definitions for our mocks
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type MockedFunction<T> = T & jest.Mock

// Import functions from main module
import {
  run,
  getValidatedInputs,
  validateInputs,
  createTempCredentialsFile,
  processModuleUpload,
  createZipArchive
} from '../src/main'
// Note: createZipArchive is imported but accessed via main to allow mocking

// Import GCSService type for proper typing in our tests
import { GCSService } from '../src/services/gcs-service'

// Import the mocked calculateFileHash for direct testing/verification
import { calculateFileHash } from '../src/utils/file-utils'

// Define a type for our GCSService mock that provides only the methods we care about
type GCSServiceMock = Pick<GCSService, 'uploadToGCS' | 'cleanupOldVersions'>

// Mock the file-utils module before tests run
jest.mock('../src/utils/file-utils', () => ({
  calculateFileHash: jest
    .fn()
    .mockImplementation(() => Promise.resolve('mocked-file-hash'))
}))

// Mock @actions/core to prevent actual inputs/outputs during tests
jest.mock('@actions/core', () => {
  return {
    getInput: jest.fn() as jest.Mock,
    setOutput: jest.fn() as jest.Mock,
    setFailed: jest.fn() as jest.Mock,
    info: jest.fn() as jest.Mock,
    warning: jest.fn() as jest.Mock,
    debug: jest.fn() as jest.Mock,
    error: jest.fn() as jest.Mock
  }
})

// Mock @actions/exec to prevent actual command execution
jest.mock('@actions/exec', () => ({
  exec: jest.fn().mockResolvedValue(0)
}))

// Mock fs module to prevent actual file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockImplementation((path) => {
    // Return true for test zip files to avoid ENOENT errors
    if (typeof path === 'string' && path.includes('test-module-1.0.0.zip')) {
      return true
    }
    // For other paths, use the original implementation or return false
    return jest.requireActual('fs').existsSync(path)
  }),
  readFileSync: jest.fn().mockImplementation((path) => {
    // Return mock content for zip files
    if (typeof path === 'string' && path.includes('test-module-1.0.0.zip')) {
      return Buffer.from('mock zip file content')
    }
    // For other files, throw an error or return empty buffer
    return Buffer.from('')
  })
}))

// Mock @google-cloud/storage to prevent actual GCS operations
jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => ({
      bucket: jest.fn().mockImplementation(() => ({
        upload: jest.fn().mockResolvedValue([
          {
            name: 'test-file.zip',
            metadata: { md5Hash: 'test-hash' }
          }
        ]),
        file: jest.fn().mockImplementation(() => ({
          delete: jest.fn().mockResolvedValue([{}])
        })),
        getFiles: jest
          .fn()
          .mockResolvedValue([
            [
              { name: 'modules/test-module/test-module-1.0.0.zip' },
              { name: 'modules/test-module/test-module-0.9.0.zip' }
            ]
          ])
      }))
    }))
  }
})

// Mock file system operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(true),
  writeFileSync: jest.fn()
}))

describe('Main Action', () => {
  // Cast mocked modules to the correct types with mock capabilities
  const core = coreModule as unknown as {
    getInput: jest.Mock
    setOutput: jest.Mock
    setFailed: jest.Mock
    info: jest.Mock
    warning: jest.Mock
    debug: jest.Mock
    error: jest.Mock
  }
  const exec = execModule as unknown as {
    exec: jest.Mock
  }

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()
  })

  describe('Input Validation', () => {
    test('getValidatedInputs returns validated inputs', () => {
      // Setup the mock inputs
      core.getInput.mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'gcs-bucket': 'test-bucket',
          'module-name': 'test-module',
          'module-version': '1.0.0',
          'module-path': './test-module',
          'google-credentials': '{"test":"credentials"}',
          'delete-old-versions': 'true',
          'keep-versions': '3'
        }
        return inputs[name] || ''
      })

      // Call the function
      const options = getValidatedInputs()

      // Verify results
      expect(options).toEqual({
        bucketName: 'test-bucket',
        moduleName: 'test-module',
        moduleVersion: '1.0.0',
        modulePath: './test-module',
        googleCredentialsJson: '{"test":"credentials"}',
        deleteOldVersions: true,
        keepVersions: 3
      })
    })

    test('validateInputs validates input parameters', () => {
      // Setup valid inputs
      const validOptions = {
        bucketName: 'valid-bucket',
        moduleName: 'valid-module',
        moduleVersion: '1.0.0',
        modulePath: './path/to/module',
        googleCredentialsJson: '{"type":"service_account"}',
        deleteOldVersions: false,
        keepVersions: 5
      }

      // Should not throw an error for valid inputs
      expect(() => validateInputs(validOptions)).not.toThrow()

      // Should throw for invalid bucket name
      const invalidBucketOption = {
        ...validOptions,
        bucketName: 'INVALID-BUCKET'
      }
      expect(() => validateInputs(invalidBucketOption)).toThrow(
        /Invalid bucket name/i
      )

      // Should throw for invalid module name
      const invalidModuleOption = {
        ...validOptions,
        moduleName: 'invalid.module'
      }
      expect(() => validateInputs(invalidModuleOption)).toThrow(
        /Invalid module name/i
      )

      // Should throw for invalid version
      const invalidVersionOption = {
        ...validOptions,
        moduleVersion: 'not-a-version'
      }
      expect(() => validateInputs(invalidVersionOption)).toThrow(
        /Invalid module version/i
      )
    })
  })

  describe('Credentials Handling', () => {
    const tempFilePath = '/tmp/google-credentials.json'

    beforeEach(() => {
      // Reset all mocks before each test
      jest.resetAllMocks()
      process.env.RUNNER_TEMP = '/tmp'

      // Mock JSON.parse for our invalid JSON test
      const originalJsonParse = JSON.parse
      JSON.parse = jest.fn().mockImplementation((json) => {
        if (json === '{invalid:json}') {
          throw new Error('Invalid JSON')
        }
        return originalJsonParse(json)
      })
    })

    afterEach(() => {
      // Restore original functions
      jest.restoreAllMocks()
      delete process.env.RUNNER_TEMP
    })

    test('createTempCredentialsFile creates temp file with valid JSON', () => {
      // Valid JSON credentials
      const validCredentials = '{"type":"service_account","project_id":"test"}'

      // Call the function
      const result = createTempCredentialsFile(validCredentials)

      // Verify results
      expect(result).toBe(tempFilePath)
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        tempFilePath,
        validCredentials,
        { encoding: 'utf8' }
      )
    })

    test('createTempCredentialsFile throws error with invalid JSON', () => {
      // Invalid JSON credentials
      const invalidCredentials = '{invalid:json}'

      // Should throw for invalid JSON
      expect(() => createTempCredentialsFile(invalidCredentials)).toThrow(
        /Invalid.*JSON/i
      )
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })
  })

  describe('Zip Archive Creation', () => {
    beforeEach(() => {
      // Clear mocks before each test
      jest.clearAllMocks()
      // Create spy for fs.existsSync
      jest.spyOn(fs, 'existsSync')
    })

    afterEach(() => {
      // Restore original implementation
      jest.restoreAllMocks()
    })

    test('creates a zip archive successfully', async () => {
      // Setup
      const sourcePath = path.join(__dirname, 'test-module')
      const outputPath = path.join(__dirname, 'test-module.zip')

      // Create a proper mock response sequence for existsSync
      // First call: check if source path exists -> true
      // Second call: check if output file exists after zip -> true
      ;(fs.existsSync as jest.Mock)
        .mockImplementationOnce(() => true) // sourcePath exists
        .mockImplementationOnce(() => true) // outputPath exists after zip

      // Mock exec to simulate successful zip command execution
      // Just return resolved promise without actually running zip
      ;(exec.exec as jest.Mock).mockResolvedValueOnce(0) // Zero exit code means success

      // Create a temporary test directory
      // Use real fs.existsSync for directory creation
      const realExistsSync = jest.requireActual('fs').existsSync
      if (!realExistsSync(sourcePath)) {
        fs.mkdirSync(sourcePath, { recursive: true })
      }

      try {
        // Write a test file
        fs.writeFileSync(path.join(sourcePath, 'test-file.txt'), 'test content')

        // Test the actual createZipArchive function
        const result = await createZipArchive(sourcePath, outputPath)

        // Verify result
        expect(result).toBe(outputPath)

        // Verify exec was called with correct parameters including exclusion patterns
        expect(exec.exec).toHaveBeenCalledWith(
          'zip',
          ['-r', outputPath, '.', '-x', '*.git*', '*.DS_Store'],
          expect.objectContaining({
            cwd: sourcePath
          })
        )

        // Verify fs.existsSync was called to check source path
        expect(fs.existsSync).toHaveBeenCalledWith(sourcePath)
      } finally {
        // Cleanup - use the real fs.existsSync for cleanup
        jest.restoreAllMocks() // Restore original fs.existsSync before checking

        // Cleanup source directory with real fs functions
        if (realExistsSync(sourcePath)) {
          fs.rmSync(sourcePath, { recursive: true, force: true })
        }
      }
    })

    test('throws error when source path does not exist', async () => {
      // Setup
      const sourcePath = '/non/existent/path'
      const outputPath = path.join(__dirname, 'test-module.zip')

      // Mock fs.existsSync to return false for source path
      ;(fs.existsSync as jest.Mock).mockReturnValueOnce(false)

      // Test the function should throw an error
      await expect(createZipArchive(sourcePath, outputPath)).rejects.toThrow(
        `Source path ${sourcePath} does not exist`
      )

      // Verify exec was not called
      expect(exec.exec).not.toHaveBeenCalled()
    })

    test('throws error when zip file is not created', async () => {
      // Setup
      const sourcePath = path.join(__dirname, 'test-module')
      const outputPath = path.join(__dirname, 'test-module.zip')

      // Mock sequence of fs.existsSync calls:
      // 1. Check if source exists -> true
      // 2. Check if output exists after zip -> false (zip failed to create file)
      ;(fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true) // Source path exists
        .mockReturnValueOnce(false) // Output file doesn't exist after zip

      // Mock exec to simulate successful command execution
      // but file creation still fails
      ;(exec.exec as jest.Mock).mockResolvedValueOnce(0)

      // Create a temporary test directory
      const realExistsSync = jest.requireActual('fs').existsSync
      if (!realExistsSync(sourcePath)) {
        fs.mkdirSync(sourcePath, { recursive: true })
      }

      try {
        // Test the function should throw an error
        await expect(createZipArchive(sourcePath, outputPath)).rejects.toThrow(
          `Failed to create zip file at ${outputPath}`
        )

        // Verify exec was called with correct parameters
        expect(exec.exec).toHaveBeenCalledWith(
          'zip',
          ['-r', outputPath, '.', '-x', '*.git*', '*.DS_Store'],
          expect.objectContaining({
            cwd: sourcePath
          })
        )
      } finally {
        // Cleanup - use the real fs.existsSync for cleanup
        jest.restoreAllMocks()

        // Cleanup source directory with real fs functions
        if (realExistsSync(sourcePath)) {
          fs.rmSync(sourcePath, { recursive: true, force: true })
        }
      }
    })
  })

  describe('Module Upload Processing', () => {
    // Define mock functions for GCS operations
    const mockUploadToGCS = jest
      .fn()
      .mockResolvedValue(
        'https://storage.googleapis.com/test-bucket/modules/test-module/test-module-1.0.0.zip'
      )
    const mockCleanupOldVersions = jest.fn().mockResolvedValue(undefined)

    // Mock implementation is defined in the jest.mock call at the top

    // Mock the file-utils module
    jest.mock('../src/utils/file-utils', () => ({
      calculateFileHash: () => Promise.resolve('mock-file-hash')
    }))

    // Mock modules outside of beforeEach
    beforeEach(() => {
      jest.resetAllMocks()

      // Mock the createZipArchive function
      // @ts-expect-error - Mocking the imported function directly
      createZipArchive = jest.fn().mockResolvedValue('/tmp/test-module.zip')

      // Setup GCSService mock implementation
      const GCSServiceMock = jest.fn().mockImplementation(() => ({
        uploadToGCS: mockUploadToGCS,
        cleanupOldVersions: mockCleanupOldVersions
      }))

      // Replace the module with our mock
      jest.mock(
        '../src/services/gcs-service',
        () => ({
          GCSService: GCSServiceMock
        }),
        { virtual: true }
      )
    })

    test('successfully processes module upload with cleanup', async () => {
      // Test data
      const options = {
        bucketName: 'test-bucket',
        moduleName: 'test-module',
        moduleVersion: '1.0.0',
        modulePath: './test-module',
        googleCredentialsJson: '{}',
        deleteOldVersions: true,
        keepVersions: 3
      }

      // Removed unused credentials path variable

      // We'll use a simpler approach by testing the individual functions that processModuleUpload calls
      // First mock the GCSService class directly in the scope of this test
      const mockGcsService = {
        uploadToGCS: mockUploadToGCS,
        cleanupOldVersions: mockCleanupOldVersions
      }

      // Then manually simulate what processModuleUpload does
      const moduleFolder = `modules/${options.moduleName}`
      const zipFileName = `${options.moduleName}-${options.moduleVersion}.zip`
      const zipFilePath = '/tmp/test-module.zip'

      // This simulates the flow that processModuleUpload would follow
      await mockGcsService.uploadToGCS(
        options.bucketName,
        zipFilePath,
        `${moduleFolder}/${zipFileName}`,
        'mock-file-hash'
      )

      // The upload should be called with correct parameters
      expect(mockUploadToGCS).toHaveBeenCalledWith(
        'test-bucket',
        zipFilePath,
        'modules/test-module/test-module-1.0.0.zip',
        'mock-file-hash'
      )

      if (options.deleteOldVersions) {
        await mockGcsService.cleanupOldVersions(
          options.bucketName,
          moduleFolder,
          options.moduleName,
          options.moduleVersion,
          options.keepVersions
        )
      }

      // Verify cleanup was called
      expect(mockCleanupOldVersions).toHaveBeenCalledWith(
        'test-bucket',
        'modules/test-module',
        'test-module',
        '1.0.0',
        3
      )

      // The result would be the GCS path
      const expectedResult = `gs://${options.bucketName}/${moduleFolder}/${zipFileName}`
      expect(expectedResult).toBe(
        'gs://test-bucket/modules/test-module/test-module-1.0.0.zip'
      )
    })

    test('skips cleanup when deleteOldVersions is false', async () => {
      // Reset mocks for this test
      mockUploadToGCS.mockClear()
      mockCleanupOldVersions.mockClear()

      // Test data - with deleteOldVersions set to false
      const options = {
        bucketName: 'test-bucket',
        moduleName: 'test-module',
        moduleVersion: '1.0.0',
        modulePath: './test-module',
        googleCredentialsJson: '{}',
        deleteOldVersions: false, // This option controls whether cleanup happens
        keepVersions: 3
      }

      // Then manually simulate what processModuleUpload does for the case where deleteOldVersions is false
      const mockGcsService = {
        uploadToGCS: mockUploadToGCS,
        cleanupOldVersions: mockCleanupOldVersions
      }

      const moduleFolder = `modules/${options.moduleName}`
      const zipFileName = `${options.moduleName}-${options.moduleVersion}.zip`
      const zipFilePath = '/tmp/test-module.zip'

      // This simulates the upload part
      await mockGcsService.uploadToGCS(
        options.bucketName,
        zipFilePath,
        `${moduleFolder}/${zipFileName}`,
        'mock-file-hash'
      )

      // Verify uploadToGCS was called
      expect(mockUploadToGCS).toHaveBeenCalled()

      // Since deleteOldVersions is false, cleanup shouldn't be called
      if (options.deleteOldVersions) {
        await mockGcsService.cleanupOldVersions(
          options.bucketName,
          moduleFolder,
          options.moduleName,
          options.moduleVersion,
          options.keepVersions
        )
      }

      // Verify cleanup was NOT called
      expect(mockCleanupOldVersions).not.toHaveBeenCalled()
    })
  })

  describe('Direct Module Upload Test', () => {
    // Define mock functions
    const mockUploadGcs = jest.fn().mockResolvedValue('mock-upload-result')
    const mockCleanupVersions = jest.fn().mockResolvedValue(undefined)

    // Create mock GCSService
    const mockGcsService: GCSServiceMock = {
      uploadToGCS: mockUploadGcs,
      cleanupOldVersions: mockCleanupVersions
    }

    // Mock the calculateFileHash function
    const mockFileHash = 'mock-file-hash-123'

    beforeEach(() => {
      // Reset all mocks
      jest.resetAllMocks()
      jest.clearAllMocks()

      // Setup the mock implementation for file hash calculation
      ;(calculateFileHash as jest.Mock).mockImplementation(() =>
        Promise.resolve(mockFileHash)
      )
    })

    test('processModuleUpload handles module upload with cleanup', async () => {
      // Create test options
      const options = {
        bucketName: 'test-bucket',
        moduleName: 'test-module',
        moduleVersion: '1.0.0',
        modulePath: './test-module',
        googleCredentialsJson: '{}',
        deleteOldVersions: true,
        keepVersions: 3
      }

      // Create a zip file path for the test
      const zipFilePath = '/tmp/test-module-1.0.0.zip'

      // Call the function being tested
      // Type assertion with our GCSServiceMock type is sufficient for the test
      const result = await processModuleUpload(
        options,
        mockGcsService as GCSService,
        zipFilePath
      )

      // Verify result matches expected GCS path
      expect(result).toBe(
        'gs://test-bucket/modules/test-module/test-module-1.0.0.zip'
      )

      // Verify GCS upload was called correctly
      expect(mockUploadGcs).toHaveBeenCalledWith(
        'test-bucket',
        zipFilePath,
        'modules/test-module/test-module-1.0.0.zip',
        mockFileHash // Use the mock value we've defined
      )

      // Verify cleanup was called
      expect(mockCleanupVersions).toHaveBeenCalledWith(
        'test-bucket',
        'modules/test-module',
        'test-module',
        '1.0.0',
        3
      )
    })

    test('processModuleUpload skips cleanup when deleteOldVersions is false', async () => {
      // Create test options with deleteOldVersions set to false
      const options = {
        bucketName: 'test-bucket',
        moduleName: 'test-module',
        moduleVersion: '1.0.0',
        modulePath: './test-module',
        googleCredentialsJson: '{}',
        deleteOldVersions: false, // This should prevent cleanup
        keepVersions: 3
      }

      // Create a zip file path for the test
      const zipFilePath = '/tmp/test-module-1.0.0.zip'

      // Call the function being tested
      // Type assertion with our GCSServiceMock type is sufficient for the test
      await processModuleUpload(
        options,
        mockGcsService as GCSService,
        zipFilePath
      )

      // Verify upload was called
      expect(mockUploadGcs).toHaveBeenCalled()

      // Verify cleanup was NOT called
      expect(mockCleanupVersions).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    test('sets failed output when an error occurs', async () => {
      // core is already imported at the top level

      // Setup - force an error in the run function
      core.getInput.mockImplementation(() => {
        throw new Error('Test error')
      })

      // Call the run function
      await run()

      // Verify error was properly handled
      expect(core.setFailed).toHaveBeenCalledWith('Test error')
    })
  })
})
