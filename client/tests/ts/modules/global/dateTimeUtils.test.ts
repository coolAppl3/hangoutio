import { hourMilliseconds, minuteMilliseconds } from '../../../../src/ts/modules/global/clientConstants';
import { getDateAndTimeString, getFullDateSTring, getTotalTimeString, getDateOrdinalSuffix } from '../../../../src/ts/modules/global/dateTimeUtils';

describe('getDateAndTimeString()', () => {
  it('should convert the timestamp into a month amd day, with and ordinal suffix, as well as a 24-hour formatted time', () => {
    expect(getDateAndTimeString(new Date(2025, 5, 1, 9, 15).getTime())).toBe('June 1st, 09:15');
    expect(getDateAndTimeString(new Date(2025, 5, 2, 9, 15).getTime())).toBe('June 2nd, 09:15');
    expect(getDateAndTimeString(new Date(2025, 5, 3, 9, 15).getTime())).toBe('June 3rd, 09:15');
    expect(getDateAndTimeString(new Date(2025, 5, 4, 9, 15).getTime())).toBe('June 4th, 09:15');

    expect(getDateAndTimeString(new Date(2025, 6, 11, 15, 45).getTime())).toBe('July 11th, 15:45');
    expect(getDateAndTimeString(new Date(2025, 6, 12, 15, 45).getTime())).toBe('July 12th, 15:45');
    expect(getDateAndTimeString(new Date(2025, 6, 13, 15, 45).getTime())).toBe('July 13th, 15:45');
    expect(getDateAndTimeString(new Date(2025, 6, 14, 15, 45).getTime())).toBe('July 14th, 15:45');

    expect(getDateAndTimeString(new Date(2025, 7, 21, 12, 30).getTime())).toBe('August 21st, 12:30');
    expect(getDateAndTimeString(new Date(2025, 7, 22, 12, 30).getTime())).toBe('August 22nd, 12:30');
    expect(getDateAndTimeString(new Date(2025, 7, 23, 12, 30).getTime())).toBe('August 23rd, 12:30');
    expect(getDateAndTimeString(new Date(2025, 7, 24, 12, 30).getTime())).toBe('August 24th, 12:30');
  });

  it('should convert the timestamp into a month amd day, with and ordinal suffix, but without the time if omitTime is true', () => {
    expect(getDateAndTimeString(new Date(2025, 5, 1, 9, 15).getTime(), true)).toBe('June 1st');
    expect(getDateAndTimeString(new Date(2025, 5, 2, 9, 15).getTime(), true)).toBe('June 2nd');
    expect(getDateAndTimeString(new Date(2025, 5, 3, 9, 15).getTime(), true)).toBe('June 3rd');
    expect(getDateAndTimeString(new Date(2025, 5, 4, 9, 15).getTime(), true)).toBe('June 4th');

    expect(getDateAndTimeString(new Date(2025, 6, 11, 15, 45).getTime(), true)).toBe('July 11th');
    expect(getDateAndTimeString(new Date(2025, 6, 12, 15, 45).getTime(), true)).toBe('July 12th');
    expect(getDateAndTimeString(new Date(2025, 6, 13, 15, 45).getTime(), true)).toBe('July 13th');
    expect(getDateAndTimeString(new Date(2025, 6, 14, 15, 45).getTime(), true)).toBe('July 14th');

    expect(getDateAndTimeString(new Date(2025, 7, 21, 12, 30).getTime(), true)).toBe('August 21st');
    expect(getDateAndTimeString(new Date(2025, 7, 22, 12, 30).getTime(), true)).toBe('August 22nd');
    expect(getDateAndTimeString(new Date(2025, 7, 23, 12, 30).getTime(), true)).toBe('August 23rd');
    expect(getDateAndTimeString(new Date(2025, 7, 24, 12, 30).getTime(), true)).toBe('August 24th');
  });
});

describe('getFullDateSTring()', () => {
  it('should convert the timestamp into a full date, but without time', () => {
    expect(getFullDateSTring(new Date(2025, 5, 1).getTime())).toBe('June 1st, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 2).getTime())).toBe('June 2nd, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 3).getTime())).toBe('June 3rd, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 4).getTime())).toBe('June 4th, 2025');

    expect(getFullDateSTring(new Date(2025, 6, 11).getTime())).toBe('July 11th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 12).getTime())).toBe('July 12th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 13).getTime())).toBe('July 13th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 14).getTime())).toBe('July 14th, 2025');

    expect(getFullDateSTring(new Date(2025, 7, 21).getTime())).toBe('August 21st, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 22).getTime())).toBe('August 22nd, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 23).getTime())).toBe('August 23rd, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 24).getTime())).toBe('August 24th, 2025');
  });

  it('should convert the timestamp into a month amd day, with and ordinal suffix, but without the time if omitTime is true', () => {
    expect(getFullDateSTring(new Date(2025, 5, 1).getTime())).toBe('June 1st, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 2).getTime())).toBe('June 2nd, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 3).getTime())).toBe('June 3rd, 2025');
    expect(getFullDateSTring(new Date(2025, 5, 4).getTime())).toBe('June 4th, 2025');

    expect(getFullDateSTring(new Date(2025, 6, 11).getTime())).toBe('July 11th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 12).getTime())).toBe('July 12th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 13).getTime())).toBe('July 13th, 2025');
    expect(getFullDateSTring(new Date(2025, 6, 14).getTime())).toBe('July 14th, 2025');

    expect(getFullDateSTring(new Date(2025, 7, 21).getTime())).toBe('August 21st, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 22).getTime())).toBe('August 22nd, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 23).getTime())).toBe('August 23rd, 2025');
    expect(getFullDateSTring(new Date(2025, 7, 24).getTime())).toBe('August 24th, 2025');
  });
});

describe('getTotalTimeString()', () => {
  it('should return the total time difference between the passed timestamps', () => {
    expect(getTotalTimeString(Date.now(), Date.now() + (hourMilliseconds * 2) + (minuteMilliseconds * 21))).toBe('2 hours, 21 minutes');
    expect(getTotalTimeString(Date.now(), Date.now() + (hourMilliseconds * 1) + (minuteMilliseconds * 15))).toBe('1 hour, 15 minutes');
    expect(getTotalTimeString(Date.now(), Date.now() + (hourMilliseconds * 3) + (minuteMilliseconds * 49))).toBe('3 hours, 49 minutes');
    expect(getTotalTimeString(Date.now(), Date.now() + (hourMilliseconds * 4) + (minuteMilliseconds * 1))).toBe('4 hours, 1 minute');
  });
});

describe('getDateOrdinalSuffix()', () => {
  it(`should return the date's ordinal suffix`, () => {
    expect(getDateOrdinalSuffix(1)).toBe('st');
    expect(getDateOrdinalSuffix(2)).toBe('nd');
    expect(getDateOrdinalSuffix(3)).toBe('rd');
    expect(getDateOrdinalSuffix(4)).toBe('th');

    expect(getDateOrdinalSuffix(11)).toBe('th');
    expect(getDateOrdinalSuffix(12)).toBe('th');
    expect(getDateOrdinalSuffix(13)).toBe('th');
    expect(getDateOrdinalSuffix(14)).toBe('th');

    expect(getDateOrdinalSuffix(21)).toBe('st');
    expect(getDateOrdinalSuffix(22)).toBe('nd');
    expect(getDateOrdinalSuffix(23)).toBe('rd');
    expect(getDateOrdinalSuffix(24)).toBe('th');

    expect(getDateOrdinalSuffix(31)).toBe('st');
  });
});