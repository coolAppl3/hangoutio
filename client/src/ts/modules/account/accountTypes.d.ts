export interface AccountDetails {
  email: string,
  username: string,
  display_name: string,
  created_on_timestamp: number,
  ongoing_email_update_request: boolean,
  ongoing_account_deletion_request: boolean,
}

export interface Friend {
  friendship_id: number,
  friendship_timestamp: number,
  friend_username: string,
  friend_display_name: string,
}

export interface FriendRequest {
  request_id: number,
  request_timestamp: number,
  requester_username: string,
  requester_display_name: string,
}

export interface Hangout {
  hangout_id: string,
  hangout_title: string,
  current_stage: number,
  is_concluded: boolean,
  created_on_timestamp: number,
}

export interface HangoutInvite {
  invite_id: number,
  hangout_id: string,
  invite_timestamp: number,
  display_name: number,
  username: number,
  hangout_title: string,
}