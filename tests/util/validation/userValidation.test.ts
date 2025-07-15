import { isValidEmail, isValidNewPassword, isValidPassword, isValidUsername, isValidDisplayName, isValidRandomCode } from '../../../src/util/validation/userValidation';

describe('isValidEmail()', () => {
  it('should return false if email is not a string', () => {
    function testEmailType(email: any): void {
      expect(isValidEmail(email)).toBe(false);
    };

    testEmailType(null);
    testEmailType(undefined);
    testEmailType(NaN);
    testEmailType(23);
    testEmailType(23.5);
    testEmailType({});
  });

  it('should return false if an invalid email is provided', () => {
    function testInvalidEmail(email: string): void {
      expect(isValidEmail(email)).toBe(false);
    };

    testInvalidEmail('');
    testInvalidEmail('invalid');
    testInvalidEmail('invalid@');
    testInvalidEmail('invalid@invalid');
    testInvalidEmail('invalid@invalid@');
    testInvalidEmail('invalid@invalid.');
    testInvalidEmail('invalid@invalid.invalid.');
    testInvalidEmail('invalid@invalid.invalid.i');
    testInvalidEmail('abc@-example.com');
    testInvalidEmail('abc@example-.com');
    testInvalidEmail('abc@.com');
    testInvalidEmail('abc@com');
    testInvalidEmail('abc@exa_mple.com');
    testInvalidEmail('abc@@example.com');
    testInvalidEmail('abc@example.c');
    testInvalidEmail('a'.repeat(65) + '@example.com');
  });

  it('should return true if a valid email is provided', () => {
    function testInvalidEmail(email: string): void {
      expect(isValidEmail(email)).toBe(true);
    };

    testInvalidEmail('example@example.com');
    testInvalidEmail('example@example.co.uk');
    testInvalidEmail('example@example.uk.gov');
  });
});

describe('isValidNewPassword()', () => {
  it('should return false if the password is not a string', () => {
    function testPasswordType(password: any): void {
      expect(isValidNewPassword(password)).toBe(false);
    };

    testPasswordType(null);
    testPasswordType(undefined);
    testPasswordType(NaN);
    testPasswordType(23);
    testPasswordType(23.5);
    testPasswordType({});
  });

  it('should return false if the password is shorter than 8 characters', () => {
    function testPasswordLength(password: string): void {
      expect(isValidNewPassword(password)).toBe(false);
    };

    testPasswordLength('');
    testPasswordLength('short');
    testPasswordLength('shortt');
    testPasswordLength('shorttt');
  });

  it('should return false if the password is longer than 40 characters', () => {
    expect(isValidNewPassword('fortyOneCharactersLongForSomeWeirdReason1')).toBe(false);
  });

  it('should return false if the password contains whitespace', () => {
    function testPasswordWhiteSpace(password: string): void {
      expect(isValidNewPassword(password)).toBe(false);
    };

    testPasswordWhiteSpace('some password');
    testPasswordWhiteSpace(' somePassword');
    testPasswordWhiteSpace(' somePassword ');
    testPasswordWhiteSpace('somePassword ');
  });

  it('should return false if the password contains anything but alphanumerical values, dots, and underscores', () => {
    function testPasswordEncoding(password: string): void {
      expect(isValidNewPassword(password)).toBe(false);
    };

    testPasswordEncoding('façadePassword');
    testPasswordEncoding('some-password');
    testPasswordEncoding('somePassword!');
    testPasswordEncoding('somePassword#');
  });

  it('should return true if a valid password is provided', () => {
    function testValidPassword(password: string): void {
      expect(isValidNewPassword(password)).toBe(true);
    };

    testValidPassword('validPassword');
    testValidPassword('alsoValid');
    testValidPassword('longButStillValidPassword');
    testValidPassword('valid.password_with_underscore');
  });
});

describe('isValidPassword()', () => {
  it('should return false if the password is not a string', () => {
    function testPasswordType(password: any): void {
      expect(isValidPassword(password)).toBe(false);
    };

    testPasswordType(null);
    testPasswordType(undefined);
    testPasswordType(NaN);
    testPasswordType(23);
    testPasswordType(23.5);
    testPasswordType({});
  });

  it('should return false if the password is an empty string', () => {
    expect(isValidPassword('')).toBe(false);
  });

  it('should return false if the password is longer than 40 characters', () => {
    expect(isValidPassword('fortyOneCharactersLongForSomeWeirdReason1')).toBe(false);
  });

  it('should return false if the password contains whitespace', () => {
    function testPasswordWhiteSpace(password: string): void {
      expect(isValidPassword(password)).toBe(false);
    };

    testPasswordWhiteSpace('some password');
    testPasswordWhiteSpace(' somePassword');
    testPasswordWhiteSpace(' somePassword ');
    testPasswordWhiteSpace('somePassword ');
  });

  it('should return true if a valid password is provided', () => {
    function testValidPassword(password: string): void {
      expect(isValidPassword(password)).toBe(true);
    };

    testValidPassword('short');
    testValidPassword('validPassword');
    testValidPassword('longButStillValidPassword');
    testValidPassword('valid.password_with_underscore');
  });
});

describe('isValidUsername()', () => {
  it('should return false if the username is not a string', () => {
    function testUsernameType(username: any): void {
      expect(isValidUsername(username)).toBe(false);
    };

    testUsernameType(null);
    testUsernameType(undefined);
    testUsernameType(NaN);
    testUsernameType(23);
    testUsernameType(23.5);
    testUsernameType({});
  });

  it('should return false if the username is shorter than 5 characters', () => {
    function testUsernameLength(username: string): void {
      expect(isValidUsername(username)).toBe(false);
    };

    testUsernameLength('');
    testUsernameLength('A');
    testUsernameLength('AB');
    testUsernameLength('john');
  });

  it('should return false if the username is longer than 25 characters', () => {
    expect(isValidUsername('beyondTwentyFiveCharacters')).toBe(false);
  });

  it('should return false if the username contains anything but alphanumerical values, dots, and underscores', () => {
    function testUsernameEncoding(username: string): void {
      expect(isValidUsername(username)).toBe(false);
    };

    testUsernameEncoding('façadeJohn');
    testUsernameEncoding('john-doe');
    testUsernameEncoding('johnDoe!');
    testUsernameEncoding('johnDoe#');
  });

  it('should return true if a valid username is provided', () => {
    function testValidUsername(username: string): void {
      expect(isValidUsername(username)).toBe(true);
    };

    testValidUsername('johnDoe');
    testValidUsername('veryLongUsername');
    testValidUsername('some_username');
    testValidUsername('some.username');
  });
});

describe('isValidDisplayName()', () => {
  it('should return false if the display name is not a string', () => {
    function testDisplayNameType(displayName: any): void {
      expect(isValidDisplayName(displayName)).toBe(false);
    };

    testDisplayNameType(null);
    testDisplayNameType(undefined);
    testDisplayNameType(NaN);
    testDisplayNameType(23);
    testDisplayNameType(23.5);
    testDisplayNameType({});
  });

  it('should return false if the display name is an empty string', () => {
    expect(isValidDisplayName('')).toBe(false);
  });

  it('should return false if the display name is longer than 25 characters', () => {
    expect(isValidDisplayName('beyondTwentyFiveCharacters')).toBe(false);
  });

  it('should return false if the display name is untrimmed', () => {
    function testDisplayNameTrimmings(displayName: string): void {
      expect(isValidDisplayName(displayName)).toBe(false);
    };

    testDisplayNameTrimmings(' John Doe');
    testDisplayNameTrimmings(' John Doe ');
    testDisplayNameTrimmings('John Doe ');
  });

  it('should return false if the display name contains double whitespace', () => {
    function testDisplayNameDoubleSpace(displayName: string): void {
      expect(isValidDisplayName(displayName)).toBe(false);
    };

    testDisplayNameDoubleSpace('John  Doe');
    testDisplayNameDoubleSpace('John Eddie  Doe');
  });

  it('should return false if the display name contains anything but English letters and valid white space', () => {
    function testDisplayNameDoubleSpace(displayName: string): void {
      expect(isValidDisplayName(displayName)).toBe(false);
    };

    testDisplayNameDoubleSpace('John Doe 1');
    testDisplayNameDoubleSpace('John Doe !');
    testDisplayNameDoubleSpace('John Doe #');
    testDisplayNameDoubleSpace('John Doe.');
  });

  it('should return true if a valid display name is provided', () => {
    function testDisplayNameDoubleSpace(displayName: string): void {
      expect(isValidDisplayName(displayName)).toBe(true);
    };

    testDisplayNameDoubleSpace('John Doe');
    testDisplayNameDoubleSpace('Sara Smith');
    testDisplayNameDoubleSpace('John Johnson');
  });
});

describe('isValidRandomCode()', () => {
  it('should return false if the verification code is not a string', () => {
    function testVerificationCodeType(verificationCode: any): void {
      expect(isValidRandomCode(verificationCode)).toBe(false);
    };

    testVerificationCodeType(null);
    testVerificationCodeType(undefined);
    testVerificationCodeType(NaN);
    testVerificationCodeType(23);
    testVerificationCodeType(23.5);
    testVerificationCodeType({});
  });

  it('should return false if the verification code is not 6 characters long', () => {
    function testVerificationCodeLength(verificationCode: string): void {
      expect(isValidRandomCode(verificationCode)).toBe(false);
    };

    testVerificationCodeLength('');
    testVerificationCodeLength('A');
    testVerificationCodeLength('AA');
    testVerificationCodeLength('AAA');
    testVerificationCodeLength('AAAA');
    testVerificationCodeLength('AAAAA');
    testVerificationCodeLength('AAAAAAA');
  });

  it('should return false if the verification code contains the letter O', () => {
    function testVerificationCodeLetters(verificationCode: string): void {
      expect(isValidRandomCode(verificationCode)).toBe(false);
    };

    testVerificationCodeLetters('AAAOAA');
    testVerificationCodeLetters('AAOAAA');
  });

  it('should return false if the verification code contains lowercase letters', () => {
    function testVerificationCodeLetters(verificationCode: string): void {
      expect(isValidRandomCode(verificationCode)).toBe(false);
    };

    testVerificationCodeLetters('aaaaaa');
    testVerificationCodeLetters('AAaAAA');
  });

  it('should return false if the verification code contains anything but uppercase English letters (not including O) and numbers', () => {
    function testVerificationCodeCharacters(verificationCode: string): void {
      expect(isValidRandomCode(verificationCode)).toBe(false);
    };

    testVerificationCodeCharacters('AAaAAA');
    testVerificationCodeCharacters('AA!AAA');
    testVerificationCodeCharacters('AA#AAA');
  });

  it('should return true if a valid verification code is provided', () => {
    function testValidVerificationCode(verificationCode: string): void {
      expect(isValidRandomCode(verificationCode)).toBe(true);
    };

    testValidVerificationCode('123456');
    testValidVerificationCode('ABCDEF');
    testValidVerificationCode('A1B2C3');
  });
});