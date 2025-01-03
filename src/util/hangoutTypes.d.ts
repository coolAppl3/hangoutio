import { RowDataPacket } from "mysql2";

// types
export interface HangoutsDetails extends RowDataPacket {
  hangout_title: string,
  members_limit: number,
  availability_period: number,
  suggestions_period: number,
  voting_period: number,
  current_stage: number,
  stage_control_timestamp: number,
  created_on_timestamp: number,
  is_concluded: boolean,
}

export interface HangoutEvent extends RowDataPacket {
  event_description: string,
  event_timestamp: number,
}

export interface HangoutMember extends RowDataPacket {
  hangout_member_id: number,
  user_type: 'account' | 'guest',
  display_name: string,
  is_leader: boolean,
}

export interface HangoutMemberCountables extends RowDataPacket {
  availability_slots_count: number,
  suggestions_count: number,
  votes_count: number,
}

export interface HangoutMessage extends RowDataPacket {
  message_id: number,
  hangout_member_id: number,
  message_content: string,
  message_timestamp: number,
}

export interface AvailabilitySlot {
  availability_slot_id: number,
  hangout_member_id: number,
  slot_start_timestamp: number,
  slot_end_timestamp: number,
}