import { validateBucketName, validateModuleName } from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateBucketName', () => {
    test('accepts valid bucket names', () => {
      expect(validateBucketName('valid-bucket-name')).toBe('valid-bucket-name');
      expect(validateBucketName('another-valid-name')).toBe('another-valid-name');
      expect(validateBucketName('valid.bucket.with.periods')).toBe('valid.bucket.with.periods');
      expect(validateBucketName('valid_bucket_with_underscores')).toBe('valid_bucket_with_underscores');
    });

    test('rejects invalid bucket names', () => {
      expect(() => validateBucketName('')).toThrow();
      expect(() => validateBucketName('ab')).toThrow(); // Too short
      expect(() => validateBucketName('UPPERCASE-INVALID')).toThrow();
      expect(() => validateBucketName('invalid!characters@')).toThrow();
      expect(() => validateBucketName('a'.repeat(64))).toThrow(); // Too long
    });
  });

  describe('validateModuleName', () => {
    test('accepts valid module names', () => {
      expect(validateModuleName('valid-module-name')).toBe('valid-module-name');
      expect(validateModuleName('validModuleName')).toBe('validModuleName');
      expect(validateModuleName('valid_module_name')).toBe('valid_module_name');
      expect(validateModuleName('ValidModuleName123')).toBe('ValidModuleName123');
    });

    test('rejects invalid module names', () => {
      expect(() => validateModuleName('')).toThrow();
      expect(() => validateModuleName('invalid.module.name')).toThrow();
      expect(() => validateModuleName('invalid/module/name')).toThrow();
      expect(() => validateModuleName('invalid:module:name')).toThrow();
      expect(() => validateModuleName('invalid module name')).toThrow();
    });
  });
});
