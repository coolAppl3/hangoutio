import { dayMilliseconds, HANGOUT_AVAILABILITY_STAGE, HANGOUT_SUGGESTIONS_STAGE, hourMilliseconds, MAX_HANGOUT_MEMBERS_LIMIT, MAX_HANGOUT_PERIOD_DAYS, MIN_HANGOUT_MEMBERS_LIMIT, MIN_HANGOUT_PERIOD_DAYS, minuteMilliseconds } from '../../../src/util/constants';
import { isValidHangoutId, isValidHangoutTitle, isValidHangoutMembersLimit, isValidTimestamp, isValidHangoutPeriods, isValidNewHangoutPeriods } from '../../../src/util/validation/hangoutValidation';

describe('isValidHangoutId()', () => {
  it('should return false if the hangout ID is not a string', () => {
    function testHangoutIdType(hangoutId: any): void {
      expect(isValidHangoutId(hangoutId)).toBe(false);
    };

    testHangoutIdType(null);
    testHangoutIdType(undefined);
    testHangoutIdType(NaN);
    testHangoutIdType(23);
    testHangoutIdType(23.5);
    testHangoutIdType({});
  });

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

describe('isValidHangoutTitle()', () => {
  it('should return false if the hangout title is not a string', () => {
    function testHangoutTitleType(hangoutTitle: any): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testHangoutTitleType(null);
    testHangoutTitleType(undefined);
    testHangoutTitleType(NaN);
    testHangoutTitleType(23);
    testHangoutTitleType(23.5);
    testHangoutTitleType({});
  });

  it('should return false if the hangout title is not trimmed', () => {
    function testHangoutTitleTrimming(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testHangoutTitleTrimming(' Some Title');
    testHangoutTitleTrimming(' Some Title ');
    testHangoutTitleTrimming('Some Title ');
  });

  it('should return false if the hangout title contains a double whitespace', () => {
    function testDoubleSpaces(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testDoubleSpaces('  Some Title');
    testDoubleSpaces('  Some Title  ');
    testDoubleSpaces('Some Title  ');
    testDoubleSpaces('Some  Title');
    testDoubleSpaces('Some Other  Title');
  });

  it('should return false if the hangout title contains anything but English letters and white space', () => {
    function testInvalidCharacters(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testInvalidCharacters('Some Title 1');
    testInvalidCharacters('Some Title !');
    testInvalidCharacters('Some Title -');
    testInvalidCharacters('piñata');
  });

  it('should return false if the hangout title is shorter than 3 characters', () => {
    function testHangoutTitleLength(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testHangoutTitleLength('');
    testHangoutTitleLength('A');
    testHangoutTitleLength('AB');
  });

  it('should return false if the hangout title is longer than 25 characters', () => {
    function testHangoutTitleLength(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(false);
    };

    testHangoutTitleLength('beyondTwentyFiveCharacters');
    testHangoutTitleLength('VeryVeryLongHangoutTitleForSomeReason');
  });

  it('should return true if a valid hangout title is provided', () => {
    function testHangoutTitleLength(hangoutTitle: string): void {
      expect(isValidHangoutTitle(hangoutTitle)).toBe(true);
    };

    testHangoutTitleLength('Hangout Title');
    testHangoutTitleLength('Valid Title');
    testHangoutTitleLength('Some Other Title');
  });
});

describe('isValidHangoutMembersLimit()', () => {
  it('should return false if the hangout members limit is not an integer', () => {
    function testMembersLimitType(limit: any): void {
      expect(isValidHangoutMembersLimit(limit)).toBe(false);
    };

    testMembersLimitType(null);
    testMembersLimitType(undefined);
    testMembersLimitType(NaN);
    testMembersLimitType('');
    testMembersLimitType('23.5');
    testMembersLimitType(23.5);
  });

  it('should return false the hangout members limit is less than the minimum allowed', () => {
    function testMembersLimit(limit: number): void {
      expect(isValidHangoutMembersLimit(limit)).toBe(false);
    };

    testMembersLimit(MIN_HANGOUT_MEMBERS_LIMIT - 1);
    testMembersLimit(MIN_HANGOUT_MEMBERS_LIMIT - 2);
    testMembersLimit(MIN_HANGOUT_MEMBERS_LIMIT - 3);
  });

  it('should return false the hangout members limit is greater than the maximum allowed', () => {
    function testMembersLimit(limit: number): void {
      expect(isValidHangoutMembersLimit(limit)).toBe(false);
    };

    testMembersLimit(MAX_HANGOUT_MEMBERS_LIMIT + 1);
    testMembersLimit(MAX_HANGOUT_MEMBERS_LIMIT + 2);
    testMembersLimit(MAX_HANGOUT_MEMBERS_LIMIT + 3);
  });

  it('should return true if a valid hangout members limit is provided', () => {
    function testMembersLimit(limit: number): void {
      expect(isValidHangoutMembersLimit(limit)).toBe(true);
    };

    testMembersLimit(MIN_HANGOUT_MEMBERS_LIMIT + 1);
    testMembersLimit(MAX_HANGOUT_MEMBERS_LIMIT - 1);
    testMembersLimit(5);
    testMembersLimit(10);
    testMembersLimit(15);
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

describe('isValidHangoutPeriods()', () => {
  it('should return false if the array length is not equal to 3', () => {
    function testHangoutPeriodsLength(hangoutPeriods: number[]): void {
      expect(isValidHangoutPeriods(hangoutPeriods)).toBe(false);
    };

    testHangoutPeriodsLength([]);
    testHangoutPeriodsLength([dayMilliseconds]);
    testHangoutPeriodsLength([dayMilliseconds, dayMilliseconds]);
    testHangoutPeriodsLength([dayMilliseconds, dayMilliseconds, dayMilliseconds, dayMilliseconds]);
  });

  it('should return false if the any of the hangout periods is equal to 0 or is not a positive integer', () => {
    function testHangoutPeriodsType(hangoutPeriods: number[]): void {
      expect(isValidHangoutPeriods(hangoutPeriods)).toBe(false);
    };

    testHangoutPeriodsType([dayMilliseconds, dayMilliseconds, 23.5]);
    testHangoutPeriodsType([dayMilliseconds, dayMilliseconds, 0.5]);
    testHangoutPeriodsType([dayMilliseconds, dayMilliseconds, -23]);
    testHangoutPeriodsType([dayMilliseconds, dayMilliseconds, dayMilliseconds * -1]);
  });

  it('should return false if the any of the hangout periods is not evenly divisible by a day in milliseconds', () => {
    function testHangoutPeriodsDayDivisibility(hangoutPeriods: number[]): void {
      expect(isValidHangoutPeriods(hangoutPeriods)).toBe(false);
    };

    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds / 2]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds - minuteMilliseconds]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds + minuteMilliseconds]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds + hourMilliseconds]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds + 0.5]);
  });

  it('should return false if the any of the hangout periods is shorter than the minimum allowed period length', () => {
    expect(isValidHangoutPeriods([dayMilliseconds, dayMilliseconds, MIN_HANGOUT_PERIOD_DAYS * dayMilliseconds - dayMilliseconds])).toBe(false);
  });

  it('should return false if the any of the hangout periods is longer than the maximum allowed period length', () => {
    expect(isValidHangoutPeriods([dayMilliseconds, dayMilliseconds, MAX_HANGOUT_PERIOD_DAYS * dayMilliseconds + dayMilliseconds])).toBe(false);
  });

  it('should return true if all the hangout periods are valid', () => {
    function testHangoutPeriodsDayDivisibility(hangoutPeriods: number[]): void {
      expect(isValidHangoutPeriods(hangoutPeriods)).toBe(true);
    };

    testHangoutPeriodsDayDivisibility([dayMilliseconds, dayMilliseconds, dayMilliseconds]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 2, dayMilliseconds * 2, dayMilliseconds * 2]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 3, dayMilliseconds * 3, dayMilliseconds * 3]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 4, dayMilliseconds * 4, dayMilliseconds * 4]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 5, dayMilliseconds * 5, dayMilliseconds * 5]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 6, dayMilliseconds * 6, dayMilliseconds * 6]);
    testHangoutPeriodsDayDivisibility([dayMilliseconds * 7, dayMilliseconds * 7, dayMilliseconds * 7]);
  });
});

describe('isValidNewHangoutPeriods()', () => {
  interface HangoutStageDetails {
    currentStage: number,
    stageControlTimestamp: number,
  };

  it('should return false if the length of either the existing periods or new periods is not equal to 3', () => {
    const hangoutStageDetails: HangoutStageDetails = {
      currentStage: HANGOUT_AVAILABILITY_STAGE,
      stageControlTimestamp: Date.now(),
    };

    function testPeriodArrays(existingPeriod: number[], newPeriods: number[]): void {
      expect(isValidNewHangoutPeriods(hangoutStageDetails, existingPeriod, newPeriods)).toBe(false);
    };

    testPeriodArrays(
      [dayMilliseconds],
      [dayMilliseconds]
    );

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds]
    );

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds, dayMilliseconds, dayMilliseconds]
    );
  });

  it('should return false if the period length for a concluded stage is not identical in both arrays', () => {
    const hangoutStageDetails: HangoutStageDetails = {
      currentStage: HANGOUT_SUGGESTIONS_STAGE,
      stageControlTimestamp: Date.now(),
    };

    function testPeriodArrays(existingPeriod: number[], newPeriods: number[]): void {
      expect(isValidNewHangoutPeriods(hangoutStageDetails, existingPeriod, newPeriods)).toBe(false);
    };

    testPeriodArrays(
      [dayMilliseconds * 2, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds, dayMilliseconds]
    );

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 2, dayMilliseconds, dayMilliseconds]
    );
  });

  it('should return false if any of the new periods, for any ongoing or yet to start stages, is invalid', () => {
    const hangoutStageDetails: HangoutStageDetails = {
      currentStage: HANGOUT_AVAILABILITY_STAGE,
      stageControlTimestamp: Date.now(),
    };

    function testPeriodArrays(existingPeriod: number[], newPeriods: number[]): void {
      expect(isValidNewHangoutPeriods(hangoutStageDetails, existingPeriod, newPeriods)).toBe(false);
    };

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, 1, dayMilliseconds]
    );

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, 23.5, dayMilliseconds]
    );

    testPeriodArrays(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds * 1.5, dayMilliseconds]
    );
  });

  it('should return false if the new period for the ongoing stage is shorter than how much time has passed in said stage', () => {
    const hangoutStageDetails: HangoutStageDetails = {
      currentStage: HANGOUT_AVAILABILITY_STAGE,
      stageControlTimestamp: Date.now() - (dayMilliseconds * 5),
    };

    function testInvalidPeriods(existingPeriod: number[], newPeriods: number[]): void {
      expect(isValidNewHangoutPeriods(hangoutStageDetails, existingPeriod, newPeriods)).toBe(false);
    };

    testInvalidPeriods(
      [dayMilliseconds * 7, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 4, dayMilliseconds, dayMilliseconds]
    );

    testInvalidPeriods(
      [dayMilliseconds * 7, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 3, dayMilliseconds, dayMilliseconds]
    );

    testInvalidPeriods(
      [dayMilliseconds * 7, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 2, dayMilliseconds, dayMilliseconds]
    );

    testInvalidPeriods(
      [dayMilliseconds * 7, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds, dayMilliseconds]
    );
  });

  it('should return true if valid new periods are provided', () => {
    const hangoutStageDetails: HangoutStageDetails = {
      currentStage: HANGOUT_AVAILABILITY_STAGE,
      stageControlTimestamp: Date.now(),
    };

    function testInvalidPeriods(existingPeriod: number[], newPeriods: number[]): void {
      expect(isValidNewHangoutPeriods(hangoutStageDetails, existingPeriod, newPeriods)).toBe(true);
    };

    testInvalidPeriods(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds, dayMilliseconds, dayMilliseconds]
    );

    testInvalidPeriods(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 2, dayMilliseconds * 2, dayMilliseconds * 2]
    );

    testInvalidPeriods(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 3, dayMilliseconds * 3, dayMilliseconds * 3]
    );

    testInvalidPeriods(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 4, dayMilliseconds * 4, dayMilliseconds * 4]
    );

    testInvalidPeriods(
      [dayMilliseconds, dayMilliseconds, dayMilliseconds],
      [dayMilliseconds * 5, dayMilliseconds * 5, dayMilliseconds * 5]
    );
  });
});