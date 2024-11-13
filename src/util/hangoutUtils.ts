import { RowDataPacket } from "mysql2";

export const hangoutStepsMap: Map<number, string> = new Map();
hangoutStepsMap.set(1, 'availability_step');
hangoutStepsMap.set(2, 'suggestions_step');
hangoutStepsMap.set(3, 'voting_step');


export function getConclusionTimestamp(
  createdOnTimestamp: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number
): number {
  const conclusionTimestamp = createdOnTimestamp + availabilityStep + suggestionsStep + votingStep;
  return conclusionTimestamp;
};

export function getNextStepTimestamp(
  currentStep: number,
  currentStepTimestamp: number,
  availabilityStep: number,
  suggestionsStep: number,
  votingStep: number
): number | null {
  if (currentStep === 1) {
    return currentStepTimestamp + availabilityStep;
  };

  if (currentStep === 2) {
    return currentStepTimestamp + suggestionsStep;
  };

  if (currentStep === 3) {
    return currentStepTimestamp + votingStep;
  };

  const weekMilliseconds: number = 1000 * 60 * 60 * 24 * 7;
  return currentStepTimestamp + weekMilliseconds;
};

export function getCurrentStepName(currentStep: number): string {
  const steps: string[] = ['availability', 'suggestions', 'voting'];
  const currentStepName: string = steps[--currentStep];

  return currentStepName;
};

// types
export interface HangoutsDetails extends RowDataPacket {
  hangout_id: string,
  hangout_title: string,
  encrypted_password: string | null,
  member_limit: number,
  availability_step: number,
  suggestions_step: number,
  voting_step: number,
  current_step: number,
  current_step_timestamp: number,
  next_step_timestamp: number,
  created_on_timestamp: number,
  conclusion_timestamp: number,
  is_concluded: boolean,
};

export interface HangoutEvent extends RowDataPacket {
  event_description: string,
  event_timestamp: number,
};

export interface HangoutMember extends RowDataPacket {
  hangout_member_id: number,
  user_type: 'account' | 'guest',
  display_name: string,
  is_leader: boolean,
};

export interface HangoutMemberCountables extends RowDataPacket {
  availability_slots_count: number,
  suggestions_count: number,
  votes_count: number,
};

export interface HangoutChat extends RowDataPacket {
  message_id: number,
  hangout_member_id: number,
  message_content: string,
  message_timestamp: number,
};