import { dayMilliseconds, hourMilliseconds, minuteMilliseconds } from '../../../src/util/constants';
import { isValidAvailabilitySlot, isValidAvailabilitySlotStart, overlapsWithExistingAvailabilitySlots } from '../../../src/util/validation/availabilitySlotValidation';

describe('isValidAvailabilitySlot()', () => {
  it('should return false if the slot start timestamp is invalid', () => {
    function testSlotStartTimestamp(slotStart: any): void {
      expect(isValidAvailabilitySlot(slotStart, Date.now())).toBe(false);
    };

    testSlotStartTimestamp(null);
    testSlotStartTimestamp(undefined);
    testSlotStartTimestamp(NaN);
    testSlotStartTimestamp('');
    testSlotStartTimestamp('23.5');
    testSlotStartTimestamp(23.5);
    testSlotStartTimestamp(23);
    testSlotStartTimestamp(23000);
  });

  it('should return false if the slot end timestamp is invalid', () => {
    function testSlotEndTimestamp(slotEnd: any): void {
      expect(isValidAvailabilitySlot(Date.now(), slotEnd)).toBe(false);
    };

    testSlotEndTimestamp(null);
    testSlotEndTimestamp(undefined);
    testSlotEndTimestamp(NaN);
    testSlotEndTimestamp('');
    testSlotEndTimestamp('23.5');
    testSlotEndTimestamp(23.5);
    testSlotEndTimestamp(23);
    testSlotEndTimestamp(23000);
  });

  it('should return false if the slot is shorter than an hour', () => {
    function testSlotLength(slotStart: number, slotEnd: number): void {
      expect(isValidAvailabilitySlot(slotStart, slotEnd)).toBe(false);
    };

    const currentTimestamp: number = Date.now();

    testSlotLength(currentTimestamp, currentTimestamp + minuteMilliseconds);
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 2));
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 10));
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 30));
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 45));
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 59));
    testSlotLength(currentTimestamp, currentTimestamp + (minuteMilliseconds * 59.5));
  });

  it('should return false if the slot is longer than 24 hours', () => {
    function testSlotLength(slotStart: number, slotEnd: number): void {
      expect(isValidAvailabilitySlot(slotStart, slotEnd)).toBe(false);
    };

    const currentTimestamp: number = Date.now();

    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + 1000);
    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + minuteMilliseconds);
    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + (minuteMilliseconds * 2));
    testSlotLength(currentTimestamp, currentTimestamp + dayMilliseconds + (minuteMilliseconds * 2));
  });

  it(`should return true if the valid timestamps are provided for the slot's start and end, and the slot's length is between an hour and 24 hours (inclusive)`, () => {
    function testValidSlot(slotStart: number, slotEnd: number): void {
      expect(isValidAvailabilitySlot(slotStart, slotEnd)).toBe(true);
    };

    const currentTimestamp: number = Date.now();

    testValidSlot(currentTimestamp, currentTimestamp + hourMilliseconds);
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 1));
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 2));
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 5));
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 10));
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 15));
    testValidSlot(currentTimestamp, currentTimestamp + (hourMilliseconds * 24));
  });
});

describe('isValidAvailabilitySlotStart()', () => {
  it('should return false if the slot start timestamp is less than the hangout conclusion timestamp', () => {
    const currentTimestamp: number = Date.now();

    function testSlotStartTimestamp(slotStart: number): void {
      expect(isValidAvailabilitySlotStart(currentTimestamp + dayMilliseconds, slotStart)).toBe(false);
    };

    testSlotStartTimestamp(currentTimestamp);
    testSlotStartTimestamp(currentTimestamp + minuteMilliseconds);
    testSlotStartTimestamp(currentTimestamp - dayMilliseconds);
    testSlotStartTimestamp(currentTimestamp + hourMilliseconds - minuteMilliseconds);
  });

  it('should return false if the slot start timestamp is beyond 6 months after the hangout conclusion timestamp', () => {
    const currentTimestamp: number = Date.now();

    function testSlotStartTimestamp(slotStart: number): void {
      expect(isValidAvailabilitySlotStart(currentTimestamp, slotStart)).toBe(false);
    };

    const dateObj: Date = new Date(currentTimestamp);
    const sixMonthsAfterTimestamp: number = dateObj.setMonth(dateObj.getMonth() + 6);


    testSlotStartTimestamp(currentTimestamp + sixMonthsAfterTimestamp + 1000);
    testSlotStartTimestamp(currentTimestamp + sixMonthsAfterTimestamp + minuteMilliseconds);
    testSlotStartTimestamp(currentTimestamp + sixMonthsAfterTimestamp + hourMilliseconds);
    testSlotStartTimestamp(currentTimestamp + sixMonthsAfterTimestamp + dayMilliseconds);
  });

  it('should return true if the slot start timestamp is within the allowed range', () => {
    const currentTimestamp: number = Date.now();

    function testSlotStartTimestamp(slotStart: number): void {
      expect(isValidAvailabilitySlotStart(currentTimestamp, slotStart)).toBe(true);
    };

    testSlotStartTimestamp(currentTimestamp);
    testSlotStartTimestamp(currentTimestamp + hourMilliseconds);
    testSlotStartTimestamp(currentTimestamp + dayMilliseconds);
    testSlotStartTimestamp(currentTimestamp + (dayMilliseconds * 2));
    testSlotStartTimestamp(currentTimestamp + (dayMilliseconds * 30));
    testSlotStartTimestamp(currentTimestamp + (dayMilliseconds * 60));
  });
});

describe('overlapsWithExistingAvailabilitySlots()', () => {
  interface NewAvailabilitySlotTimestamps {
    slotStartTimestamp: number,
    slotEndTimestamp: number,
  };

  interface AvailabilitySlot {
    availability_slot_id: number,
    hangout_member_id: number,
    slot_start_timestamp: number,
    slot_end_timestamp: number,
  };

  it('should return null if the length of the existing slots array is 0', () => {
    const newAvailabilitySlotTimestamps: NewAvailabilitySlotTimestamps = {
      slotEndTimestamp: Date.now(),
      slotStartTimestamp: Date.now() + hourMilliseconds
    };

    expect(overlapsWithExistingAvailabilitySlots([], newAvailabilitySlotTimestamps)).toBeNull();
  });

  it('should return the first existing slot that overlaps with the new slot', () => {
    const currentTimestamp: number = Date.now();

    const existingSlot: AvailabilitySlot = {
      availability_slot_id: 1,
      hangout_member_id: 1,
      slot_start_timestamp: currentTimestamp,
      slot_end_timestamp: currentTimestamp + (hourMilliseconds * 4),
    };

    function testSlotOverlaps(slotStartTimestamp: number, slotEndTimestamp: number): void {
      expect(overlapsWithExistingAvailabilitySlots([existingSlot], { slotStartTimestamp, slotEndTimestamp })).toBe(existingSlot);
    };

    testSlotOverlaps(currentTimestamp - hourMilliseconds, currentTimestamp + hourMilliseconds);
    testSlotOverlaps(currentTimestamp + hourMilliseconds, currentTimestamp + (hourMilliseconds * 2));
    testSlotOverlaps(currentTimestamp + (hourMilliseconds * 3), currentTimestamp + (hourMilliseconds * 8));
  });

  it('should return null if no overlap is detected', () => {
    const currentTimestamp: number = Date.now();

    const existingSlot: AvailabilitySlot = {
      availability_slot_id: 1,
      hangout_member_id: 1,
      slot_start_timestamp: currentTimestamp,
      slot_end_timestamp: currentTimestamp + (hourMilliseconds * 4),
    };

    function testValidTimeSlots(slotStartTimestamp: number, slotEndTimestamp: number): void {
      expect(overlapsWithExistingAvailabilitySlots([existingSlot], { slotStartTimestamp, slotEndTimestamp })).toBeNull();
    };

    testValidTimeSlots(currentTimestamp - (hourMilliseconds * 2), currentTimestamp - hourMilliseconds);
    testValidTimeSlots(currentTimestamp - hourMilliseconds - minuteMilliseconds, currentTimestamp - minuteMilliseconds);
    testValidTimeSlots(currentTimestamp + (hourMilliseconds * 4) + minuteMilliseconds, currentTimestamp + (hourMilliseconds * 5) + minuteMilliseconds);
  });
});