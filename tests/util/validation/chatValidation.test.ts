import { isValidMessageContent } from '../../../src/util/validation/chatValidation';

describe('isValidMessageContent()', () => {
  it('should return false if the message is not a string', () => {
    function testMessageType(message: any): void {
      expect(isValidMessageContent(message)).toBe(false);
    };

    testMessageType(null);
    testMessageType(undefined);
    testMessageType(NaN);
    testMessageType(23);
    testMessageType(23.5);
    testMessageType({});
  });

  it('should return false if the message is untrimmed', () => {
    function testMessageTrimming(message: string): void {
      expect(isValidMessageContent(message)).toBe(false);
    };

    testMessageTrimming(' some message');
    testMessageTrimming(' some message ');
    testMessageTrimming('some message ');
  });

  it('should return false if message is empty', () => {
    expect(isValidMessageContent('')).toBe(false);
  });

  it('should return false if message is beyond 2000 characters long', () => {
    let extremelyLongMessage: string = '';

    for (let i = 0; i < 2001; i++) {
      extremelyLongMessage += 'A';
    };

    expect(isValidMessageContent(extremelyLongMessage)).toBe(false);
  });

  it('should return false if message contains any non-ASCII characters', () => {
    function testMessageEncoding(message: string): void {
      expect(isValidMessageContent(message)).toBe(false);
    };

    testMessageEncoding('façade');
    testMessageEncoding('naïve');
    testMessageEncoding('piñata');
    testMessageEncoding('crème brûlée');
    testMessageEncoding('smörgåsbord');
  });

  it('should return true if the message is valid', () => {
    function testMessageEncoding(message: string): void {
      expect(isValidMessageContent(message)).toBe(true);
    };

    testMessageEncoding('A');
    testMessageEncoding('Some message');
    testMessageEncoding('This is a test message.');
    testMessageEncoding('Never doing the waterfall methodology again :)');
  });
});