export interface HangoutsDetails {
  hangout_title: string,
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

export interface HangoutEvent {
  event_description: string,
  event_timestamp: number,
};

export interface HangoutMember {
  hangout_member_id: number,
  user_type: 'account' | 'guest',
  display_name: string,
  is_leader: boolean,
};

export interface HangoutMemberCountables {
  availability_slots_count: number,
  suggestions_count: number,
  votes_count: number,
};

export interface HangoutChat {
  message_id: number,
  hangout_member_id: number,
  message_content: string,
  message_timestamp: number,
};