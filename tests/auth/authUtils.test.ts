import { isValidAuthSessionId, isValidAuthSessionDetails } from '../../src/auth/authUtils';
import { hourMilliseconds } from '../../src/util/constants';


interface AuthSessionDetails {
  user_id: number,
  user_type: 'account' | 'guest',
  expiry_timestamp: number,
};

type ExpectedUserType = ('account' | 'guest') | null;

describe('isValidAuthSessionId()', () => {
  it('should return false if the authSessionId is not 32 characters long', () => {
    function testLength(authSessionId: string): void {
      expect(isValidAuthSessionId(authSessionId)).toBe(false);
    };

    testLength('');
    testLength('invalid');
    testLength('belowThirtyTwoCharacters');
    testLength('invalidIdBeyondThirtyTwoCharactersLong');
  });

  it('should return false if the authSessionId contains anything but latin alphanumerical characters', () => {
    function testCharacters(authSessionId: string): void {
      expect(isValidAuthSessionId(authSessionId)).toBe(false);
    };

    testCharacters('dummy_authSessionId_for_testing_');
    testCharacters('dummy-authSessionId-for-testing-');
    testCharacters('dummy=authSessionId=for=testing=');
    testCharacters('dummy!authSessionId!for!testing!');
    testCharacters('dummy#authSessionId#for#testing#');
    testCharacters('dummy authSessionId for testing ');
  });

  it('should return true if the authSessionId is valid', () => {
    expect(isValidAuthSessionId('dummyAuthSessionIdForTesting1234')).toBe(true);
  });
});

describe('isValidAuthSessionDetails()', () => {
  it('should return false if an expected user type is provided, but the auth session details do not match said type', () => {
    function testUserType(authSessionDetails: AuthSessionDetails, expectedUserType: ExpectedUserType | null): void {
      expect(isValidAuthSessionDetails(authSessionDetails, expectedUserType)).toBe(false);
    };

    testUserType({
      user_id: 1,
      user_type: 'account',
      expiry_timestamp: Date.now(),
    }, 'guest');

    testUserType({
      user_id: 1,
      user_type: 'guest',
      expiry_timestamp: Date.now(),
    }, 'account');
  });

  it('should return false if the auth session has expired', () => {
    function testExpiredAuthSession(authSessionDetails: AuthSessionDetails, expectedUserType: ExpectedUserType | null = null): void {
      expect(isValidAuthSessionDetails(authSessionDetails, expectedUserType)).toBe(false);
    };

    testExpiredAuthSession({
      user_id: 1,
      user_type: 'account',
      expiry_timestamp: Date.now() - hourMilliseconds,
    });

    testExpiredAuthSession({
      user_id: 1,
      user_type: 'account',
      expiry_timestamp: Date.now(),
    });
  });

  it('should return true if the auth session details are valid', () => {
    function testValidAuthSession(authSessionDetails: AuthSessionDetails, expectedUserType: ExpectedUserType | null = null): void {
      expect(isValidAuthSessionDetails(authSessionDetails, expectedUserType)).toBe(true);
    };

    testValidAuthSession({
      user_id: 1,
      user_type: 'account',
      expiry_timestamp: Date.now() + hourMilliseconds,
    });

    testValidAuthSession({
      user_id: 1,
      user_type: 'account',
      expiry_timestamp: Date.now() + hourMilliseconds,
    }, 'account');

    testValidAuthSession({
      user_id: 1,
      user_type: 'guest',
      expiry_timestamp: Date.now() + hourMilliseconds,
    });

    testValidAuthSession({
      user_id: 1,
      user_type: 'guest',
      expiry_timestamp: Date.now() + hourMilliseconds,
    }, 'guest');
  });
});