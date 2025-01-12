import { dbPool } from "./db";

export async function initDb(): Promise<void> {
  await createAccountsTable();
  await createAccountVerificationTable();
  await createAccountRecoveryTable();
  await createAccountDeletionTable();
  await createEmailUpdateTable();
  await createFriendRequestsTable();
  await createFriendshipsTable();
  await createHangoutsTable();
  await createHangoutEventsTable();
  await createGuestsTable();
  await createHangoutMembersTable();
  await createAvailabilitySlotsTable();
  await createSuggestionsTable();
  await createVotesTable();
  await createChatTable();
  await createAuthSessionsTable();

  console.log('Database initialized.')
};

async function createAccountsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS accounts (
        account_id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(254) NOT NULL UNIQUE,
        hashed_password VARCHAR(255) NOT NULL,
        username VARCHAR(40) NOT NULL UNIQUE,
        display_name VARCHAR(40) NOT NULL,
        created_on_timestamp BIGINT NOT NULL,
        is_verified BOOLEAN NOT NULL,
        failed_sign_in_attempts INT NOT NULL CHECK(failed_sign_in_attempts <= 5)
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createAccountVerificationTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS account_verification (
        verification_id INT PRIMARY KEY AUTO_INCREMENT,
        account_id INT NOT NULL UNIQUE,
        verification_code VARCHAR(10) NOT NULL COLLATE utf8mb4_bin,
        verification_emails_sent INT NOT NULL CHECK(verification_emails_sent <= 3),
        failed_verification_attempts INT NOT NULL CHECK(failed_verification_attempts <= 3),
        expiry_timestamp BIGINT NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createAccountRecoveryTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS account_recovery (
        recovery_id INT PRIMARY KEY AUTO_INCREMENT,
        account_id INT NOT NULL UNIQUE,
        recovery_code VARCHAR(10) NOT NULL COLLATE utf8mb4_bin,
        expiry_timestamp BIGINT NOT NULL,
        recovery_emails_sent INT NOT NULL CHECK(recovery_emails_sent <= 3),
        failed_recovery_attempts INT NOT NULL CHECK(failed_recovery_attempts <= 3),
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createAccountDeletionTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS account_deletion (
        deletion_id INT PRIMARY KEY AUTO_INCREMENT,
        account_id INT NOT NULL UNIQUE,
        confirmation_code VARCHAR(10) NOT NULL COLLATE utf8mb4_bin,
        expiry_timestamp BIGINT NOT NULL,
        failed_deletion_attempts INT NOT NULL CHECK(failed_deletion_attempts <= 3),
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createEmailUpdateTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS email_update (
        update_id INT PRIMARY KEY AUTO_INCREMENT,
        account_id INT NOT NULL UNIQUE,
        new_email VARCHAR(254) NOT NULL UNIQUE,
        verification_code VARCHAR(10) NOT NULL COLLATE utf8mb4_bin,
        expiry_timestamp BIGINT NOT NULL,
        update_emails_sent INT NOT NULL CHECK(update_emails_sent <= 3),
        failed_update_attempts INT NOT NULL CHECK(failed_update_attempts <= 3),
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createFriendRequestsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS friend_requests (
        request_id INT PRIMARY KEY AUTO_INCREMENT,
        requester_id INT NOT NULL,
        requestee_id INT NOT NULL,
        request_timestamp BIGINT NOT NULL,
        UNIQUE(requester_id, requestee_id),
        FOREIGN KEY (requester_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
        FOREIGN KEY (requestee_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createFriendshipsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS friendships (
        friendship_id INT PRIMARY KEY AUTO_INCREMENT,
        account_id INT NOT NULL,
        friend_id INT NOT NULL,
        friendship_timestamp BIGINT NOT NULL,
        UNIQUE(account_id, friend_id),
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
        FOREIGN KEY (friend_id) REFERENCES accounts(account_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createHangoutsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS hangouts (
        hangout_id VARCHAR(65) PRIMARY KEY COLLATE utf8mb4_bin,
        hangout_title VARCHAR(40) NOT NULL,
        encrypted_password VARCHAR(255),
        members_limit INT NOT NULL CHECK (members_limit BETWEEN 2 AND 20),
        availability_period BIGINT NOT NULL,
        suggestions_period BIGINT NOT NULL,
        voting_period BIGINT NOT NULL,
        current_stage INT CHECK (current_stage BETWEEN 1 AND 4),
        stage_control_timestamp BIGINT NOT NULL,
        created_on_timestamp BIGINT NOT NULL,
        is_concluded BOOLEAN NOT NULL
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createHangoutEventsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS hangout_events (
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        event_description VARCHAR(500) NOT NULL,
        event_timestamp BIGINT NOT NULL,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createGuestsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS guests (
        guest_id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(40) NOT NULL UNIQUE,
        hashed_password VARCHAR(255) NOT NULL,
        display_name VARCHAR(40) NOT NULL,
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createHangoutMembersTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS hangout_members (
        hangout_member_id INT PRIMARY KEY AUTO_INCREMENT,
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        user_type ENUM('account', 'guest') NOT NULL,
        account_id INT,
        guest_id INT,
        display_name VARCHAR(40) NOT NULL,
        is_leader BOOLEAN NOT NULL,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE,
        UNIQUE (hangout_id, account_id),
        UNIQUE (hangout_id, guest_id)
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createAvailabilitySlotsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS availability_slots (
        availability_slot_id INT PRIMARY KEY AUTO_INCREMENT,
        hangout_member_id INT NOT NULL, 
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        slot_start_timestamp BIGINT NOT NULL,
        slot_end_timestamp BIGINT NOT NULL,
        FOREIGN KEY (hangout_member_id) REFERENCES hangout_members(hangout_member_id) ON DELETE CASCADE,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createSuggestionsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS suggestions (
        suggestion_id INT PRIMARY KEY AUTO_INCREMENT,
        hangout_member_id INT,
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        suggestion_title VARCHAR(60) NOT NULL,
        suggestion_description VARCHAR(600) NOT NULL,
        suggestion_start_timestamp BIGINT NOT NULL,
        suggestion_end_timestamp BIGINT NOT NULL,
        is_edited BOOLEAN NOT NULL,
        FOREIGN KEY (hangout_member_id) REFERENCES hangout_members(hangout_member_id) ON DELETE SET NULL,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createVotesTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS votes (
        vote_id INT PRIMARY KEY AUTO_INCREMENT,
        hangout_member_id INT,
        suggestion_id INT NOT NULL,
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        FOREIGN KEY (hangout_member_id) REFERENCES hangout_members(hangout_member_id) ON DELETE CASCADE,
        FOREIGN KEY (suggestion_id) REFERENCES suggestions(suggestion_id) ON DELETE CASCADE,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE,
        UNIQUE (hangout_member_id, suggestion_id)
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createChatTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS chat (
        message_id INT PRIMARY KEY AUTO_INCREMENT,
        hangout_member_id INT,
        hangout_id VARCHAR(65) NOT NULL COLLATE utf8mb4_bin,
        message_content VARCHAR(600) NOT NULL,
        message_timestamp BIGINT NOT NULL,
        FOREIGN KEY (hangout_member_id) REFERENCES hangout_members(hangout_member_id) ON DELETE SET NULL,
        FOREIGN KEY (hangout_id) REFERENCES hangouts(hangout_id) ON DELETE CASCADE
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};

async function createAuthSessionsTable(): Promise<void> {
  try {
    await dbPool.execute(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id VARCHAR(65) PRIMARY KEY COLLATE utf8mb4_bin,
        user_id INT NOT NULL,
        user_type ENUM('account', 'guest') NOT NULL,
        created_on_timestamp BIGINT NOT NULL,
        expiry_timestamp BIGINT NOT NULL
      );`
    );

  } catch (err: unknown) {
    console.log(err);
  };
};