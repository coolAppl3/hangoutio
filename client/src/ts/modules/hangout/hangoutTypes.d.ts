export interface HangoutsDetails {
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

export interface HangoutEvent {
  event_description: string,
  event_timestamp: number,
}

export interface HangoutMember {
  hangout_member_id: number,
  user_type: 'account' | 'guest',
  display_name: string,
  is_leader: boolean,
}

export interface HangoutMemberCountables {
  availability_slots_count: number,
  suggestions_count: number,
  votes_count: number,
}

export interface HangoutMessage {
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

export interface Suggestion {
  suggestion_id: number,
  hangout_member_id: number,
  suggestion_title: string,
  suggestion_description: string,
  suggestion_start_timestamp: number,
  suggestion_end_timestamp: number,
  is_edited: boolean,
  likes_count: number,
  votes_count: number,
}

export interface SuggestionLike {
  suggestion_like_id: number,
  hangout_member_id: number,
  suggestion_id: number,
}

export interface Vote {
  vote_id: number,
  hangout_member_id: number,
  suggestion_id: number,
}