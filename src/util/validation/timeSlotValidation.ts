type TimeSlot = { from: string, to: string };

export function isValidTimeSlotsString(slotsString: string): boolean {
  const timeSlotsArray: TimeSlot[] = [];

  if (typeof slotsString !== 'string') {
    return false;
  };

  if (slotsString.length === 0) {
    return true;
  };

  if (!isValidSlotStringLength(slotsString)) {
    return false;
  };

  const slotsArray: string[] = slotsString.split(',');

  if (slotsArray.length > 3) {
    return false;
  };

  for (const slot of slotsArray) {
    if (!isValidSlot(slot, timeSlotsArray)) {
      return false;
    };
  };

  return true;
};

function isValidSlotStringLength(slotsString: string): boolean {
  const validLengths: number[] = [13, 27, 41];
  return validLengths.includes(slotsString.length);
};

function isValidSlot(slot: string, timeSlotsArray: TimeSlot[]): boolean {
  const timeValueArray: string[] = slot.split(' - ');

  const from: string = timeValueArray[0];
  const to: string = timeValueArray[1];

  if (!isValidTimeFormat(from) || !isValidTimeFormat(to)) {
    return false;
  };

  if (getTimeNumber(to) - getTimeNumber(from) < 100) {
    return false;
  };

  const newSlot: TimeSlot = { from, to };

  if (timeSlotsArray.length === 0) {
    timeSlotsArray.push(newSlot);
    return true;
  };

  if (intersectsWithExistingSlots(newSlot, timeSlotsArray)) {
    return false;
  };


  timeSlotsArray.push(newSlot);
  return true;
};


function intersectsWithExistingSlots(newSlot: TimeSlot, timeSlotsArray: TimeSlot[]): boolean {
  for (const slot of timeSlotsArray) {
    if (endsMatch(slot, newSlot)) {
      return true;
    };

    if (isWithinExistingSlot(slot, newSlot.from) || isWithinExistingSlot(slot, newSlot.to)) {
      return true;
    };

    if (includesExistingSlot(slot, newSlot)) {
      return true;
    };
  };

  return false;
};

function endsMatch(slot: TimeSlot, newSlot: TimeSlot): boolean {
  if (slot.from === newSlot.from || slot.from === newSlot.to) {
    return true;
  };

  if (slot.to === newSlot.from || slot.to === newSlot.to) {
    return true;
  };

  return false;
};

function isWithinExistingSlot(slot: TimeSlot, time: string): boolean {
  const slotFrom: number = getTimeNumber(slot.from);
  const slotTo: number = getTimeNumber(slot.to);
  const timeNumber: number = getTimeNumber(time);

  if (timeNumber > slotFrom && timeNumber < slotTo) {
    return true;
  };

  return false;
};

function includesExistingSlot(slot: TimeSlot, newSlot: TimeSlot): boolean {
  if (getTimeNumber(newSlot.from) < getTimeNumber(slot.from) && getTimeNumber(newSlot.to) > getTimeNumber(slot.to)) {
    return true;
  };

  return false;
};

function getTimeNumber(time: string): number {
  const timeNumber: number = +(time.split(':').join(''));

  if (Number.isNaN(timeNumber)) {
    return 0;
  };

  return timeNumber;
};

const validTimeFormatRegex: RegExp = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
function isValidTimeFormat(timeValue: string): boolean {
  return validTimeFormatRegex.test(timeValue);
};