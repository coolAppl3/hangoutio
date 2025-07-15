import { dayMilliseconds, hourMilliseconds, minuteMilliseconds } from '../../../src/util/constants';
import { isValidSuggestionTitle, isValidSuggestionDescription, isValidSuggestionTimeSlot, isValidSuggestionSlotStart } from '../../../src/util/validation/suggestionValidation';

describe('isValidSuggestionTitle()', () => {
  it('should return false if the suggestion title is not a string', () => {
    function testSuggestionTitleType(title: any): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testSuggestionTitleType(null);
    testSuggestionTitleType(undefined);
    testSuggestionTitleType(NaN);
    testSuggestionTitleType(23);
    testSuggestionTitleType(23.5);
    testSuggestionTitleType({});
  });

  it('should return false if the suggestion title is untrimmed', () => {
    function testSuggestionTitleTrimmings(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testSuggestionTitleTrimmings(' Some Title');
    testSuggestionTitleTrimmings(' Some Title ');
    testSuggestionTitleTrimmings('Some Title ');
  });

  it('should return false if the suggestion title contains double whitespace', () => {
    function testSuggestionTitleDoubleWhitespace(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testSuggestionTitleDoubleWhitespace('Some  Title');
    testSuggestionTitleDoubleWhitespace('Some Other  Title');
  });

  it('should return false if the suggestion title contains anything but alphanumerical values, valid whitespace, and the following allowed symbols: .-()!?', () => {
    function testValidCharacters(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testValidCharacters('Some Title #');
    testValidCharacters('Some Title %');
    testValidCharacters('Some Title ^');
    testValidCharacters('Some Title &');
    testValidCharacters('Some Title façade');
  });

  it('should return false if the suggestion title is shorter than 3 characters', () => {
    function testSuggestionTitleLength(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testSuggestionTitleLength('AB');
    testSuggestionTitleLength('A');
    testSuggestionTitleLength('');
  });

  it('should return false if the suggestion title is longer than 40 characters', () => {
    function testSuggestionTitleLength(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(false);
    };

    testSuggestionTitleLength('Extremely Long Suggestion Title For Some Reason');
    testSuggestionTitleLength('A Title That Is Forty One Characters Long');
  });

  it('should return true if the suggestion title is valid', () => {
    function testValidSuggestionTitle(title: string): void {
      expect(isValidSuggestionTitle(title)).toBe(true);
    };

    testValidSuggestionTitle('Valid Suggestion Title');
    testValidSuggestionTitle('Another Valid Title');
    testValidSuggestionTitle('Also Valid');
    testValidSuggestionTitle('Valid');
  });
});

describe('isValidSuggestionDescription()', () => {
  it('should return false if the suggestion description is not a string', () => {
    function testSuggestionDescriptionType(description: any): void {
      expect(isValidSuggestionDescription(description)).toBe(false);
    };

    testSuggestionDescriptionType(null);
    testSuggestionDescriptionType(undefined);
    testSuggestionDescriptionType(NaN);
    testSuggestionDescriptionType(23);
    testSuggestionDescriptionType(23.5);
    testSuggestionDescriptionType({});
  });

  it('should return false if the suggestion description is untrimmed', () => {
    function testSuggestionDescriptionTrimmings(description: string): void {
      expect(isValidSuggestionDescription(description)).toBe(false);
    };

    testSuggestionDescriptionTrimmings(' Some suggestion description');
    testSuggestionDescriptionTrimmings(' Some suggestion description ');
    testSuggestionDescriptionTrimmings('Some suggestion description ');
  });

  it('should return false if the suggestion description contains any non-ASCII characters', () => {
    function testSuggestionDescriptionEncoding(description: string): void {
      expect(isValidSuggestionDescription(description)).toBe(false);
    };

    testSuggestionDescriptionEncoding('Suggestion description façade');
    testSuggestionDescriptionEncoding('Suggestion description naïve');
    testSuggestionDescriptionEncoding('Suggestion description piñata');
    testSuggestionDescriptionEncoding('Suggestion description crème brûlée');
    testSuggestionDescriptionEncoding('Suggestion description smörgåsbord');
  });

  it('should return false if the suggestion description is shorter than 10 characters', () => {
    function testSuggestionDescriptionLength(description: string): void {
      expect(isValidSuggestionDescription(description)).toBe(false);
    };

    testSuggestionDescriptionLength('Too short');
    testSuggestionDescriptionLength('Short');
    testSuggestionDescriptionLength('');
  });

  it('should return false if the suggestion description is longer than 500 characters', () => {
    let extremelyLongDescription: string = '';

    for (let i = 0; i < 501; i++) {
      extremelyLongDescription += 'A';
    };

    expect(isValidSuggestionDescription(extremelyLongDescription)).toBe(false);
  });
});

describe('isValidSuggestionTimeSlot()', () => {
  it('should return false if the suggestion slot start or slot end values are not valid timestamps', () => {
    function testSlotEndings(slotStart: number, slotEnd: number): void {
      expect(isValidSuggestionTimeSlot(slotStart, slotEnd)).toBe(false);
    };

    testSlotEndings(1, 1);
    testSlotEndings(23.5, 23.5);
    testSlotEndings(1752617790775, 999999999999999);
    testSlotEndings(999999999999999, 1752617790775);
    testSlotEndings(-1752617790775, 1752617790775);
    testSlotEndings(1752617790775, -1752617790775);
  });

  it('should return false if the suggestion slot is shorter than an hour', () => {
    function testSlotLength(slotStart: number, slotEnd: number): void {
      expect(isValidSuggestionTimeSlot(slotStart, slotEnd)).toBe(false);
    };

    const currentTimestamp: number = Date.now();

    testSlotLength(currentTimestamp, currentTimestamp + hourMilliseconds - 1000);
    testSlotLength(currentTimestamp, currentTimestamp + hourMilliseconds - minuteMilliseconds);
    testSlotLength(currentTimestamp, currentTimestamp + (hourMilliseconds / 2));
  });

  it('should return false if the suggestion slot is longer than a day', () => {
    function testSlotLength(slotStart: number, slotEnd: number): void {
      expect(isValidSuggestionTimeSlot(slotStart, slotEnd)).toBe(false);
    };

    const currentTimestamp: number = Date.now();

    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + 1000);
    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + minuteMilliseconds);
    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + hourMilliseconds);
  });

  it('should return true if a valid suggestion slot is provided', () => {
    function testValidSuggestionSlot(slotStart: number, slotEnd: number): void {
      expect(isValidSuggestionTimeSlot(slotStart, slotEnd)).toBe(true);
    };

    const currentTimestamp: number = Date.now();

    testValidSuggestionSlot(currentTimestamp, currentTimestamp + hourMilliseconds);
    testValidSuggestionSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 1));
    testValidSuggestionSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 3));
    testValidSuggestionSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 5));
    testValidSuggestionSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 10));
    testValidSuggestionSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 15));
  });
});

describe('isValidSuggestionSlotStart()', () => {
  it('should return false if the slot start is before than the hangout conclusion timestamp', () => {
    const hangoutConclusionTimestamp: number = Date.now() + dayMilliseconds;

    function testEarlySuggestionStartSlot(slotStart: number): void {
      expect(isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart)).toBe(false);
    };

    testEarlySuggestionStartSlot(hangoutConclusionTimestamp - 1000);
    testEarlySuggestionStartSlot(hangoutConclusionTimestamp - minuteMilliseconds);
    testEarlySuggestionStartSlot(hangoutConclusionTimestamp - hourMilliseconds);
    testEarlySuggestionStartSlot(hangoutConclusionTimestamp - dayMilliseconds);
  });

  it('should return false if the slot start is beyond 6 months after the hangout conclusion timestamp', () => {
    const hangoutConclusionTimestamp: number = Date.now() + dayMilliseconds;

    function testLateSuggestionStartSlot(slotStart: number): void {
      expect(isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart)).toBe(false);
    };

    testLateSuggestionStartSlot(hangoutConclusionTimestamp + (dayMilliseconds * 30 * 6.5));
    testLateSuggestionStartSlot(hangoutConclusionTimestamp + (dayMilliseconds * 30 * 7));
    testLateSuggestionStartSlot(hangoutConclusionTimestamp + (dayMilliseconds * 30 * 8));
    testLateSuggestionStartSlot(hangoutConclusionTimestamp + (dayMilliseconds * 30 * 12));
  });

  it('should return true if a valid suggestion slot start is provided', () => {
    const hangoutConclusionTimestamp: number = Date.now() + dayMilliseconds;

    function testValidSuggestionSlotStart(slotStart: number): void {
      expect(isValidSuggestionSlotStart(hangoutConclusionTimestamp, slotStart)).toBe(true);
    };

    testValidSuggestionSlotStart(hangoutConclusionTimestamp);
    testValidSuggestionSlotStart(hangoutConclusionTimestamp + 1000);
    testValidSuggestionSlotStart(hangoutConclusionTimestamp + minuteMilliseconds);
    testValidSuggestionSlotStart(hangoutConclusionTimestamp + hourMilliseconds);
    testValidSuggestionSlotStart(hangoutConclusionTimestamp + dayMilliseconds);
    testValidSuggestionSlotStart(hangoutConclusionTimestamp + (dayMilliseconds * 30 * 5));
  });
});