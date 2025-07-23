import { dayMilliseconds, hourMilliseconds, minuteMilliseconds } from '../../../../../src/util/constants';
import ErrorSpan from '../../../../src/ts/modules/global/ErrorSpan';
import { validateEmail, validateHangoutTitle, validateNewPassword, validatePassword, validateConfirmPassword, validateUsername, validateDisplayName, validateCode, validateSuggestionTitle, validateSuggestionDescription, isValidHangoutId, isValidTimestamp, isValidQueryString } from '../../../../src/ts/modules/global/validation';

let mainInput: HTMLInputElement | undefined;
let secondaryInput: HTMLInputElement | undefined;
let textarea: HTMLTextAreaElement | undefined;

let errorSpanDisplayMock: jest.SpyInstance | undefined;
let errorSpanHideMock: jest.SpyInstance | undefined;

beforeEach(() => {
  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);

  mainInput = document.createElement('input');
  secondaryInput = document.createElement('input');
  textarea = document.createElement('textarea');

  document.body.appendChild(mainInput);
  document.body.appendChild(secondaryInput);
  document.body.appendChild(textarea);

  errorSpanDisplayMock = jest.spyOn(ErrorSpan, 'display').mockImplementation(jest.fn());
  errorSpanHideMock = jest.spyOn(ErrorSpan, 'hide').mockImplementation(jest.fn());
});

afterEach(() => {
  jest.resetAllMocks();

  mainInput = undefined;
  secondaryInput = undefined;
  textarea = undefined;

  errorSpanDisplayMock = undefined;
  errorSpanHideMock = undefined;
});

describe('validateEmail()', () => {
  it('should return false if the email is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateEmail(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid email address is required.');
  });

  it('should return false if the email contains whitespace', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = 'some email';

    expect(validateEmail(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Email address must not contain whitespace.');
  });

  it('should return false if the email is invalid', () => {
    function testInvalidEmail(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateEmail(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Invalid email address.');
    };

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

  it('should return true if the email is valid', () => {
    function testValidEmail(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateEmail(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidEmail('valid@exmaple.com');
    testValidEmail('valid23@alsoValid.co.uk');
    testValidEmail('another.valid.23@veryvalid.co.gov');
  });
});

describe('validateHangoutTitle', () => {
  it('should return false if the title is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateHangoutTitle(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid hangout title is required.');
  });

  it('should return false if the title is untrimmed', () => {
    function testTitleTrimmings(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Whitespace must not exist at either ends of the title.');
    };

    testTitleTrimmings(' Some title');
    testTitleTrimmings(' Some title ');
    testTitleTrimmings('Some title ');
  });

  it('should return false if the title is shorter than 3 characters', () => {
    function testTitleLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Title must at least contain 3 characters.');
    };

    testTitleLength('A');
    testTitleLength('AB');
  });

  it('should return false if the title is longer 25 characters', () => {
    function testTitleLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Title must not exceed 25 characters.');
    };

    testTitleLength('beyondTwentyFiveCharacters');
    testTitleLength('beyondTwentyFiveCharacterss');
    testTitleLength('beyondTwentyFiveCharactersss');
  });

  it('should return false if the title contains more than a single whitespace between words', () => {
    function testRecurringWhitespace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only one whitespace is allowed between words.');
    };

    testRecurringWhitespace('Some  Title');
    testRecurringWhitespace('Some Other  Title');
    testRecurringWhitespace('Some  Other Title');
  });

  it('should return false if the title contains non english letters', () => {
    function testTitleEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English letters are allowed.');
    };

    testTitleEncoding('façade');
    testTitleEncoding('naïve');
    testTitleEncoding('piñata');
    testTitleEncoding('crème brûlée');
    testTitleEncoding('smörgåsbord');
  });

  it('should return true if the title is valid', () => {
    function testValidTitle(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateHangoutTitle(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidTitle('Valid Title');
    testValidTitle('Another Valid Title');
  });
});

describe('validateNewPassword()', () => {
  it('should return false if the password is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateNewPassword(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid password is required.');
  });

  it('should return false if the password contains whitespace', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = 'some password';

    expect(validateNewPassword(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Password must not contain whitespace.');
  });

  it('should return false if the password is shorter than 8 characters', () => {
    function testPasswordLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateNewPassword(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Password must at least contain 8 characters.');
    };

    testPasswordLength('a');
    testPasswordLength('ab');
    testPasswordLength('abc');
    testPasswordLength('abcd');
    testPasswordLength('abcde');
    testPasswordLength('abcdef');
    testPasswordLength('abcdefg');
  });

  it('should return false if the password is longer than 40 characters', () => {
    function testPasswordLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateNewPassword(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Password must not exceed 40 characters.');
    };

    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReason');
    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReasonn');
    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReasonnn');
  });

  it('should return false if the password contains non english letters', () => {
    function testPasswordEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateNewPassword(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English alphanumerical characters, dots, and underscores are allowed.');
    };

    testPasswordEncoding('test_façade');
    testPasswordEncoding('test_naïve');
    testPasswordEncoding('test_piñata');
    testPasswordEncoding('crème.brûlée');
    testPasswordEncoding('smörgåsbord');
  });

  it('should return false if the password contains anything but alphanumerical values, dots, and underscores', () => {
    function testInvalidPassword(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateNewPassword(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English alphanumerical characters, dots, and underscores are allowed.');
    };

    testInvalidPassword('some!password');
    testInvalidPassword('some#password');
    testInvalidPassword('some?password');
    testInvalidPassword('some%password');
  });

  it('should return true if the password is valid', () => {
    function testValidPassword(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateNewPassword(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidPassword('validPassword');
    testValidPassword('anotherValidPassword');
    testValidPassword('also_valid');
    testValidPassword('very.much.valid');
    testValidPassword('very.much.valid_with_3');
  });
});

describe('validatePassword()', () => {
  it('should return false if the password is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validatePassword(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid password is required.');
  });

  it('should return false if the password contains white space', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = 'some password';

    expect(validatePassword(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Password must not contain whitespace.');
  });

  it('should return false if the password is longer than 40 characters', () => {
    function testPasswordLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validatePassword(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Password must not exceed 40 characters.');
    };

    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReason');
    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReasonn');
    testPasswordLength('beyondFortyCharactersForSomeIncrediblyWeirdReasonnn');
  });

  it('should return true if the password is valid (intentionally less strict)', () => {
    function testValidPassword(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validatePassword(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidPassword('validPassword');
    testValidPassword('anotherValidPassword');
    testValidPassword('also_valid');
    testValidPassword('very.much.valid');
    testValidPassword('very.much.valid_with_3');
  });
});

describe('validateConfirmPassword()', () => {
  it('should return false if the confirmation password, after being trimmed, is an empty string', () => {
    function testConfirmationPassword(value: string): void {
      if (!mainInput || !secondaryInput) {
        throw new Error('One or more of the inputs are undefined.');
      };

      mainInput.value = 'somePassword';
      secondaryInput.value = value;

      expect(validateConfirmPassword(secondaryInput, mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(secondaryInput, 'Password confirmation is required.');
    };

    testConfirmationPassword('');
    testConfirmationPassword(' ');
    testConfirmationPassword('    ');
  });

  it('should return false if the confirmation password is not identical to the password provided', () => {
    function testConfirmationPassword(value: string): void {
      if (!mainInput || !secondaryInput) {
        throw new Error('One or more of the inputs are undefined.');
      };

      mainInput.value = 'somePassword';
      secondaryInput.value = value;

      expect(validateConfirmPassword(secondaryInput, mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(secondaryInput, `Passwords don't match.`);
    };

    testConfirmationPassword('someOtherValue');
    testConfirmationPassword('yetAnotherValue');
    testConfirmationPassword('invalid but still not identical');
  });

  it('should return true if the confirmation password is identical to the password provided', () => {
    if (!mainInput || !secondaryInput) {
      throw new Error('One or more of the inputs are undefined.');
    };

    mainInput.value = 'somePassword';
    secondaryInput.value = 'somePassword';

    expect(validateConfirmPassword(secondaryInput, mainInput)).toBe(true);
    expect(errorSpanHideMock).toHaveBeenCalledWith(secondaryInput);
  });
});

describe('validateUsername()', () => {
  it('should return false if the username is an empty string ', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateUsername(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid username is required.');
  });

  it('should return false if the username contains whitespace', () => {
    function testUsernameWhiteSpace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Username must not contain whitespace.');
    };

    expect(testUsernameWhiteSpace(' someUsername'));
    expect(testUsernameWhiteSpace(' someUsername '));
    expect(testUsernameWhiteSpace('someUsername '));
    expect(testUsernameWhiteSpace('some username'));
  });

  it('should return false if username is shorter than 5 characters', () => {
    function testUsernameLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Username must at least contain 5 characters.');
    };

    expect(testUsernameLength('a'));
    expect(testUsernameLength('ab'));
    expect(testUsernameLength('abc'));
    expect(testUsernameLength('abcd'));
  });

  it('should return false if username is longer than 25 characters', () => {
    function testUsernameLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Username must not exceed 25 characters.');
    };

    testUsernameLength('beyondTwentyFiveCharacters');
    testUsernameLength('beyondTwentyFiveCharacterss');
    testUsernameLength('beyondTwentyFiveCharactersss');
  });

  it('should return false if the username contains non english letters', () => {
    function testUsernameEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English alphanumerical characters, dots, and underscores are allowed.');
    };

    testUsernameEncoding('test_façade');
    testUsernameEncoding('test_naïve');
    testUsernameEncoding('test_piñata');
    testUsernameEncoding('crème.brûlée');
    testUsernameEncoding('smörgåsbord');
  });

  it('should return false if the username contains anything but alphanumerical values, dots, and underscores', () => {
    function testInvalidUsername(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English alphanumerical characters, dots, and underscores are allowed.');
    };

    testInvalidUsername('some!username');
    testInvalidUsername('some#username');
    testInvalidUsername('some?username');
    testInvalidUsername('some%username');
  });

  it('should return true if the username is valid', () => {
    function testValidUsername(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateUsername(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidUsername('validUsername');
    testValidUsername('anotherValidUsername');
    testValidUsername('also_valid');
    testValidUsername('very.much.valid');
    testValidUsername('very.much.valid_with_3');
  });
});

describe('validateDisplayName()', () => {
  it('should return false if the display name is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateDisplayName(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid display name is required.');
  });

  it('should return false if the display name is untrimmed', () => {
    function testDisplayNameTrimmings(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateDisplayName(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Whitespace must not exist at either ends of the display name.');
    };

    testDisplayNameTrimmings(' John Doe');
    testDisplayNameTrimmings(' John Doe ');
    testDisplayNameTrimmings('John Doe ');
  });

  it('should return false if the display name is longer than 25 characters', () => {
    function testDisplayNameLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateDisplayName(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Display name must not exceed 25 characters.');
    };

    testDisplayNameLength('beyondTwentyFiveCharacters');
    testDisplayNameLength('beyondTwentyFiveCharacterss');
    testDisplayNameLength('beyondTwentyFiveCharactersss');
  });

  it('should return false if the display name contains more than a single whitespace between words', () => {
    function testRecurringWhitespace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateDisplayName(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only one whitespace is allowed between words.');
    };

    testRecurringWhitespace('John  Doe');
    testRecurringWhitespace('John Doe  Smith');
  });

  it('should return false if the display name contains anything but english letters and singular whitespaces', () => {
    function testDisplayNameEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateDisplayName(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only English letters and a single space between words are allowed.');
    };

    testDisplayNameEncoding('façade');
    testDisplayNameEncoding('naïve');
    testDisplayNameEncoding('piñata');
    testDisplayNameEncoding('crème brûlée');
    testDisplayNameEncoding('smörgåsbord');
  });

  it('should return true if the display name is valid', () => {
    function testDisplayNameEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateDisplayName(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testDisplayNameEncoding('A');
    testDisplayNameEncoding('AJ');
    testDisplayNameEncoding('AJ John');
    testDisplayNameEncoding('John Doe');
    testDisplayNameEncoding('Jonathan Reeds');
  });
});

describe('validateCode()', () => {
  it('should return false if the code contains the letter O', () => {
    function testLetterO(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined');
      };

      mainInput.value = value;

      expect(validateCode(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, `Code can't contain the letter "O". Try replacing it with the number 0.`);
    };

    testLetterO('AAOAAA');
    testLetterO('OAAAAA');
    testLetterO('OAAAAO');
    testLetterO('AAAOAA');
  });

  it('should return false if the code contains whitespace', () => {
    function testWhitespace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined');
      };

      mainInput.value = value;

      expect(validateCode(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Code must not contain whitespace.');
    };

    testWhitespace('AAA AAA');
    testWhitespace('AAA AA');
    testWhitespace('A AA AA');
  });

  it('should return false if the code is not 6 characters long', () => {
    function testWhitespace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined');
      };

      mainInput.value = value;

      expect(validateCode(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Code must be 6 characters long.');
    };

    testWhitespace('A');
    testWhitespace('AA');
    testWhitespace('AAA');
    testWhitespace('AAAA');
    testWhitespace('AAAAA');
    testWhitespace('AAAAAAA');
    testWhitespace('AAAAAAAA');
  });

  it('should return false if the code contains anything but alphanumerical values, apart from the letter O', () => {
    function testCodeEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined');
      };

      mainInput.value = value;

      expect(validateCode(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, `Only uppercase English letters and numbers are allowed, apart from the letter "O".`);
    };

    testCodeEncoding('façade');
    testCodeEncoding('naïvee');
    testCodeEncoding('piñata');
  });

  it('should return true if the code is valid', () => {
    function testValidCode(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined');
      };

      mainInput.value = value;

      expect(validateCode(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidCode('ABCDEF');
    testValidCode('123456');
    testValidCode('A1B2C3');
    testValidCode('abcdef');
    testValidCode('a1b1c1');
  });
});

describe('validateSuggestionTitle()', () => {
  it('should return false if the suggestion title is an empty string', () => {
    if (!mainInput) {
      throw new Error('Input is undefined.');
    };

    mainInput.value = '';

    expect(validateSuggestionTitle(mainInput)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'A valid suggestion title is required.');
  });

  it('should return false if the suggestion title is untrimmed', () => {
    function testTitleTrimmings(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Whitespace must not exist at either ends of the display name.');
    };

    testTitleTrimmings(' Some Title');
    testTitleTrimmings(' Some Title ');
    testTitleTrimmings('Some Title ');
  });

  it('should return false if the suggestion title is shorter than 3 characters', () => {
    function testTitleLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Title must at least contain 3 characters.');
    };

    testTitleLength('A');
    testTitleLength('AB');
  });

  it('should return false if the suggestion title is longer than 40 characters', () => {
    function testTitleLength(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Title must not exceed 40 characters.');
    };

    testTitleLength('Some Very Interesting Suggestion Downtown');
    testTitleLength('Some Very Interesting Suggestion By The Beach');
  });

  it('should return false if the suggestion title contains more than a single whitespace between words', () => {
    function testRecurringWhitespace(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only one whitespace is allowed between words.');
    };

    testRecurringWhitespace('Some  Title');
    testRecurringWhitespace('Some Other  Title');
  });

  it('should return false if the suggestion title contains anything but alphanumerical values, valid whitespace, and the following allowed symbols: .-()!?', () => {
    function testTitleEncoding(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(mainInput, 'Only letters, numbers, whitespace, and the following symbols are allowed: ()!?.');
    };

    testTitleEncoding('façade');
    testTitleEncoding('naïve');
    testTitleEncoding('piñata');
    testTitleEncoding('crème brûlée');
    testTitleEncoding('smörgåsbord');
    testTitleEncoding('some$title');
    testTitleEncoding('some#title');
    testTitleEncoding('some%title');
  });

  it('should return true if the suggestion title is valid', () => {
    function testValidTitle(value: string): void {
      if (!mainInput) {
        throw new Error('Input is undefined.');
      };

      mainInput.value = value;

      expect(validateSuggestionTitle(mainInput)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(mainInput);
    };

    testValidTitle('Valid Title');
    testValidTitle('Valid Title?');
    testValidTitle('Valid Title!');
    testValidTitle('Valid Title.');
    testValidTitle('Valid Title (also valid)');
    testValidTitle('Valid Title - Also Valid');
  });
});

describe('validateSuggestionDescription()', () => {
  it('should return false if the suggestion description is an empty string', () => {
    if (!textarea) {
      throw new Error('Textarea is undefined.');
    };

    textarea.value = '';

    expect(validateSuggestionDescription(textarea)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(textarea, 'A suggestion description is required.');
  });

  it('should return false if the suggestion description is shorter than 10 characters', () => {
    function testDescriptionLength(value: string): void {
      if (!textarea) {
        throw new Error('Textarea is undefined.');
      };

      textarea.value = value;

      expect(validateSuggestionDescription(textarea)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(textarea, 'Description must at least contain 10 characters.');
    };

    testDescriptionLength('A');
    testDescriptionLength('AA');
    testDescriptionLength('AAA');
    testDescriptionLength('AAAA');
    testDescriptionLength('AAAAA');
    testDescriptionLength('AAAAAA');
    testDescriptionLength('AAAAAAA');
    testDescriptionLength('AAAAAAAA');
    testDescriptionLength('AAAAAAAAA');
  });

  it('should return false if the suggestion description is shorter than 10 characters', () => {
    if (!textarea) {
      throw new Error('Textarea is undefined.');
    };

    let longDescription: string = '';

    for (let i = 0; i < 501; i++) {
      longDescription += 'A';
    };

    textarea.value = longDescription;

    expect(validateSuggestionDescription(textarea)).toBe(false);
    expect(errorSpanDisplayMock).toHaveBeenCalledWith(textarea, 'Description must not exceed 500 characters.');
  });

  it('should return false if the suggestion description is untrimmed', () => {
    function testDescriptionTrimmings(value: string): void {
      if (!textarea) {
        throw new Error('Textarea is undefined.');
      };

      textarea.value = value;

      expect(validateSuggestionDescription(textarea)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(textarea, 'Description must not start or end with whitespace or line breaks.');
    };

    testDescriptionTrimmings(' Some suggestion description.');
    testDescriptionTrimmings(' Some suggestion description. ');
    testDescriptionTrimmings('Some suggestion description. ');

    testDescriptionTrimmings('\nSome suggestion description.');
    testDescriptionTrimmings('\nSome suggestion description.\n');
    testDescriptionTrimmings('Some suggestion description.\n');
  });

  it('should return false if the suggestion description contains any non-ASCII characters', () => {
    function testDescriptionEncoding(value: string): void {
      if (!textarea) {
        throw new Error('Textarea is undefined.');
      };

      textarea.value = value;

      expect(validateSuggestionDescription(textarea)).toBe(false);
      expect(errorSpanDisplayMock).toHaveBeenCalledWith(textarea, 'Only English letters, numbers, and common symbols are allowed.');
    };

    testDescriptionEncoding('Some description façade');
    testDescriptionEncoding('Some description naïve');
    testDescriptionEncoding('Some description piñata');
    testDescriptionEncoding('Some description crème brûlée');
    testDescriptionEncoding('Some description smörgåsbord');
  });

  it('should return true if the suggestion description is valid', () => {
    function testValidDescription(value: string): void {
      if (!textarea) {
        throw new Error('Textarea is undefined.');
      };

      textarea.value = value;

      expect(validateSuggestionDescription(textarea)).toBe(true);
      expect(errorSpanHideMock).toHaveBeenCalledWith(textarea);
    };

    testValidDescription('Some suggestion description.');
    testValidDescription('Some other suggestion description.');

    let longDescription: string = '';

    for (let i = 0; i < 500; i++) {
      longDescription += 'A';
    };

    testValidDescription(longDescription);
  });
});

describe('isValidHangoutId()', () => {
  it('should return false if the hangout ID length is not 46', () => {
    function testHangoutIdLength(hangoutId: string): void {
      expect(isValidHangoutId(hangoutId)).toBe(false);
    };

    testHangoutIdLength('');
    testHangoutIdLength('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    testHangoutIdLength('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR');
    testHangoutIdLength('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013_');
  });

  it('should return false if the hangout ID does not have an underscore at the 32 index', () => {
    function testHangoutIdUnderscore(hangoutId: string): void {
      expect(isValidHangoutId(hangoutId)).toBe(false);
    };

    testHangoutIdUnderscore('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR/1749132719013');
    testHangoutIdUnderscore('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR-1749132719013');
    testHangoutIdUnderscore('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR01749132719013');
    testHangoutIdUnderscore('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR!1749132719013');
  });

  it('should return false if the hangout ID does not have a valid timestamp after the underscore', () => {
    function testHangoutIdTimestamp(hangoutId: string): void {
      expect(isValidHangoutId(hangoutId)).toBe(false);
    };

    testHangoutIdTimestamp('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_T174913271901');
    testHangoutIdTimestamp('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR__174913271901');
  });

  it('should return false if the hangout ID contains any characters that are not alphanumerical or underscore', () => {
    function testHangoutIdCharacters(hangoutId: string): void {
      expect(isValidHangoutId(hangoutId)).toBe(false);
    };

    testHangoutIdCharacters('htUJOeoHJhuI8O7JA4HZPTBq7e8x7Tg-_1749132719013');
    testHangoutIdCharacters('htUJOeoHJhuI8O7JA4HZPTBq7e8x7Tg!_1749132719013');
    testHangoutIdCharacters('htUJOeoHJhuI8O7JA4HZPTBq7e8x7Tg#_1749132719013');
    testHangoutIdCharacters('htUJOeoHJhuI8O7JA4HZPTBq7e8x7Tg%_1749132719013');
  });

  it('should return true if a valid hangout ID is provided', () => {
    function testValidHangoutId(hangoutId: string): void {
      expect(isValidHangoutId(hangoutId)).toBe(true);
    };

    testValidHangoutId('htUJOeoHJhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
    testValidHangoutId('htUJOeoLKhuI8O7JA4HZPTBq7e8x7TgR_1749132719013');
    testValidHangoutId('htUJOeo23huI8O7JA4HZPTBq7e8x7TgR_1749132719013');
    testValidHangoutId('htUJOeo94huI8O7JA4HZPTBq7e8x7TgR_1749132719013');
  });
});

describe('isValidTimestamp()', () => {
  it('should return false if the timestamp is not an integer', () => {
    function testTimestampType(timestamp: any): void {
      expect(isValidTimestamp(timestamp)).toBe(false);
    };

    testTimestampType(null);
    testTimestampType(undefined);
    testTimestampType(NaN);
    testTimestampType('');
    testTimestampType('23');
    testTimestampType(23.5);
  });

  it('should return false if the timestamp digit length is not equal to 13', () => {
    function testTimestampDigits(timestamp: number): void {
      expect(isValidTimestamp(timestamp)).toBe(false);
    };

    testTimestampDigits(1234567890);
    testTimestampDigits(12345678901);
    testTimestampDigits(123456789012);
    testTimestampDigits(12345678901245);
    testTimestampDigits(123456789012456);
  });

  it('should return false if the timestamp is negative', () => {
    expect(isValidTimestamp(-1752611141409)).toBe(false);
  });

  it('should return true if a valid timestamp is provided', () => {
    function testValidTimestamp(timestamp: number): void {
      expect(isValidTimestamp(timestamp)).toBe(true);
    };

    testValidTimestamp(Date.now());
    testValidTimestamp(Date.now() - minuteMilliseconds);
    testValidTimestamp(Date.now() - hourMilliseconds);
    testValidTimestamp(Date.now() - dayMilliseconds);
  });
});

describe('isValidQueryString()', () => {
  it('should return false if the query string is empty', () => {
    expect(isValidQueryString('')).toBe(false);
  });

  it('should return false if the query string does not start with ?', () => {
    function testFirstQueryStringCharacter(queryString: string): void {
      expect(isValidQueryString(`${queryString}`)).toBe(false);
    };

    testFirstQueryStringCharacter('a');
    testFirstQueryStringCharacter('b');
    testFirstQueryStringCharacter('c');
    testFirstQueryStringCharacter('d');
  });

  it('should return false if the query string does not start with an alphanumerical value after the ?', () => {
    function testFirstQueryStringCharacter(queryString: string): void {
      expect(isValidQueryString(`?${queryString}`)).toBe(false);
    };

    testFirstQueryStringCharacter('!');
    testFirstQueryStringCharacter('@');
    testFirstQueryStringCharacter('#');
    testFirstQueryStringCharacter('$');
    testFirstQueryStringCharacter('%');
    testFirstQueryStringCharacter('^');
    testFirstQueryStringCharacter('&');
  });

  it('should return false if the query string is longer, including the ?, is longer than 152 characters long', () => {
    let queryString: string = '?';

    for (let i = 0; i < 153; i++) {
      queryString += 'a';
    };

    expect(isValidQueryString(queryString)).toBe(false);
  });
});