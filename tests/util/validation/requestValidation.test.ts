import { undefinedValuesDetected } from '../../../src/util/validation/requestValidation';

describe('undefinedValuesDetected()', () => {
  interface RequestData {
    [key: string]: any,
  };

  it('should return true if the number of keys in the requestData object does not match the length of the expectedKeys array', () => {
    function testKeysArrayLengthMatch(requestData: RequestData, expectedKeys: string[]): void {
      expect(undefinedValuesDetected(requestData, expectedKeys)).toBe(true);
    };

    testKeysArrayLengthMatch(
      { key1: 'key1', key2: 'key2' },
      ['key1']
    );

    testKeysArrayLengthMatch(
      { key1: 'key1', key2: 'key2' },
      ['key1', 'key2', 'key3']
    );
  });

  it('should return true if any of the expected keys are not present on the requestData object', () => {
    function testMissingKeys(requestData: RequestData, expectedKeys: string[]): void {
      expect(undefinedValuesDetected(requestData, expectedKeys)).toBe(true);
    };

    testMissingKeys(
      { key1: 'key1', key2: 'key2' },
      ['key1', 'key2', 'key3']
    );

    testMissingKeys(
      { key1: 'key1', key2: 'key2' },
      ['key1', 'key2', 'key4']
    );
  });

  it('should return false if all the expected keys are available on the requestData object', () => {
    function testValidKeys(requestData: RequestData, expectedKeys: string[]): void {
      expect(undefinedValuesDetected(requestData, expectedKeys)).toBe(false);
    };

    testValidKeys(
      { key1: 'key1', key2: 'key2' },
      ['key1', 'key2']
    );

    testValidKeys(
      { key1: 'key1', key2: 'key2', key3: 'key3' },
      ['key1', 'key2', 'key3']
    );
  });
});