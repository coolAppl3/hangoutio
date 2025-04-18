import { createBtnElement, createDivElement, createSpanElement, createSvgElement } from "../../global/domUtils";
import { getDateAndTimeString, getTotalTimeString } from "../../global/dateTimeUtils";
import { AvailabilitySlot } from "../hangoutTypes";

export function createAvailabilitySlotElement(slot: AvailabilitySlot): HTMLDivElement {
  const availabilitySlotElement: HTMLDivElement = createDivElement('slot');
  availabilitySlotElement.setAttribute('data-slotId', `${slot.availability_slot_id}`);

  availabilitySlotElement.appendChild(createSlotInfoElement('Start', getDateAndTimeString(slot.slot_start_timestamp), 'slot-start'));
  availabilitySlotElement.appendChild(createSlotInfoElement('End', getDateAndTimeString(slot.slot_end_timestamp), 'slot-end'));
  availabilitySlotElement.appendChild(createSlotInfoElement('Total', getTotalTimeString(slot.slot_start_timestamp, slot.slot_end_timestamp), 'slot-total'));

  availabilitySlotElement.appendChild(createSlotBtnContainer());

  return availabilitySlotElement;
};

function createSlotInfoElement(title: string, value: string, infoClass: string): HTMLDivElement {
  const slotInfoElement: HTMLDivElement = createDivElement(`slot-info ${infoClass}`);

  slotInfoElement.appendChild(createSpanElement(null, title));
  slotInfoElement.appendChild(createSpanElement(null, value));

  return slotInfoElement;
};

function createSlotBtnContainer(): HTMLDivElement {
  const slotBtnContainer: HTMLDivElement = createDivElement('slot-btn-container');

  const deleteBtn: HTMLButtonElement = createBtnElement('delete-btn', null);
  deleteBtn.setAttribute('title', 'Delete slot');
  deleteBtn.setAttribute('aria-label', 'Delete availability slot');

  const trashBinSvg: SVGSVGElement = createSvgElement(540, 540);

  const trashBinSvgPath: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trashBinSvgPath.setAttribute('fill-rule', 'evenodd');
  trashBinSvgPath.setAttribute('clip-rule', 'evenodd');
  trashBinSvgPath.setAttribute('d', 'M201 22C188.85 22 179 31.8497 179 44V47H75C61.1929 47 50 58.1929 50 72C50 85.8071 61.1929 97 75 97H465C478.807 97 490 85.8071 490 72C490 58.1929 478.807 47 465 47H362.333V44C362.333 31.8497 352.484 22 340.333 22H201ZM80 117L98.1421 477.113C99.2678 499.459 117.714 517 140.089 517H399.911C422.286 517 440.732 499.46 441.858 477.113L460 117H80ZM178 187C165.297 187 155 197.297 155 210V424C155 436.703 165.297 447 178 447C190.703 447 201 436.703 201 424V210C201 197.297 190.703 187 178 187ZM247 210C247 197.297 257.297 187 270 187C282.703 187 293 197.297 293 210V424C293 436.703 282.703 447 270 447C257.297 447 247 436.703 247 424V210ZM362 187C349.297 187 339 197.297 339 210V424C339 436.703 349.297 447 362 447C374.703 447 385 436.703 385 424V210C385 197.297 374.703 187 362 187Z');

  trashBinSvg.appendChild(trashBinSvgPath);
  deleteBtn.appendChild(trashBinSvg);

  const editBtn: HTMLButtonElement = createBtnElement('edit-btn', null);
  editBtn.setAttribute('title', 'Edit slot');
  editBtn.setAttribute('aria-label', 'Edit availability slot');

  const editSvg: SVGSVGElement = createSvgElement(640, 640);

  const firstEditSvgPath: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  firstEditSvgPath.setAttribute('d', 'M266.547 152.906C266.547 142.413 258.04 133.906 247.547 133.906H135C75.3533 133.906 27 182.259 27 241.906V505C27 564.647 75.3533 613 135 613H398.094C457.741 613 506.094 564.647 506.094 505V392.453C506.094 381.96 497.587 373.453 487.094 373.453H445.094C434.601 373.453 426.094 381.96 426.094 392.453V505C426.094 520.464 413.558 533 398.094 533H135C119.536 533 107 520.464 107 505V241.906C107 226.442 119.536 213.906 135 213.906H247.547C258.04 213.906 266.547 205.399 266.547 194.906V152.906Z');

  const secondEditSvgPath: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  secondEditSvgPath.setAttribute('d', 'M242.834 291.217L424.82 109.23L530.3 214.71L348.313 396.696C345.447 399.562 341.902 401.656 338.009 402.782L237.376 431.875C219.223 437.124 202.406 420.307 207.655 402.154L236.748 301.521C237.874 297.628 239.968 294.083 242.834 291.217Z');

  const thirdEditSvgPath: SVGPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  thirdEditSvgPath.setAttribute('d', 'M472.203 62.8635L438.542 96.525L544.099 202.083L577.761 168.421C597.287 148.895 597.287 117.237 577.761 97.7107L542.914 62.8635C523.387 43.3373 491.729 43.3373 472.203 62.8635Z');

  editSvg.appendChild(firstEditSvgPath);
  editSvg.appendChild(secondEditSvgPath);
  editSvg.appendChild(thirdEditSvgPath);
  editBtn.appendChild(editSvg);

  slotBtnContainer.appendChild(deleteBtn);
  slotBtnContainer.appendChild(editBtn);

  return slotBtnContainer;
};