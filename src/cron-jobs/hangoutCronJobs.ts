import { dbPool } from "../db/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { HANGOUT_AVAILABILITY_STAGE, HANGOUT_CONCLUSION_STAGE, HANGOUT_SUGGESTIONS_STAGE, HANGOUT_VOTING_STAGE } from "../util/constants";
import { hangoutClients } from "../webSockets/hangout/hangoutWebSocketServer";
import WebSocket from "ws";

export async function progressHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    interface HangoutDetails extends RowDataPacket {
      hangout_id: string,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
          hangout_id
        FROM
          hangouts
        WHERE
          (:currentTimestamp - stage_control_timestamp) >= availability_period AND current_stage = ${HANGOUT_AVAILABILITY_STAGE}
          OR
          (:currentTimestamp - stage_control_timestamp) >= suggestions_period AND current_stage = ${HANGOUT_SUGGESTIONS_STAGE}
          OR
          (:currentTimestamp - stage_control_timestamp) >= voting_period AND current_stage = ${HANGOUT_VOTING_STAGE}
        LIMIT 100;`,
      { currentTimestamp }
    );

    if (hangoutRows.length === 0) {
      return;
    };

    const hangoutIdsToProgress: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);

    await dbPool.query(
      `UPDATE
        hangouts
      SET
        is_concluded = CASE
          WHEN current_stage = ${HANGOUT_VOTING_STAGE} THEN TRUE
          ELSE is_concluded
        END,
        current_stage = current_stage + 1,
        stage_control_timestamp = :currentTimestamp
      WHERE
        hangout_id IN (:hangoutIdsToProgress);`,
      { currentTimestamp, hangoutIdsToProgress }
    );

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_member_id: number,
    };

    const [hangoutMemberRows] = await dbPool.query<HangoutMemberDetails[]>(
      `SELECT
        hangout_member_id
      FROM
        hangout_members
      WHERE
        hangout_id IN (?);`,
      [hangoutIdsToProgress]
    );

    const webSocketData = {
      type: 'hangoutStageUpdate',
      reason: 'hangoutProgressed',
      data: { currentTimestamp },
    };

    for (const member of hangoutMemberRows) {
      const ws: WebSocket | undefined = hangoutClients.get(member.hangout_member_id)?.ws;

      if (!ws) {
        continue;
      };

      ws.send(JSON.stringify(webSocketData), (err: Error | undefined) => err && console.log(err));
    };

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${progressHangouts.name}`);
    console.log(err);
  };
};

concludeNoSuggestionHangouts();

export async function concludeNoSuggestionHangouts(): Promise<void> {
  const currentTimestamp: number = Date.now();

  try {
    interface HangoutDetails extends RowDataPacket {
      hangout_id: string,
    };

    const [hangoutRows] = await dbPool.execute<HangoutDetails[]>(
      `SELECT
        hangouts.hangout_id
      FROM
        hangouts
      LEFT JOIN
        suggestions ON hangouts.hangout_id = suggestions.hangout_id
      WHERE
        hangouts.current_stage = ${HANGOUT_VOTING_STAGE} AND
        suggestions.suggestion_id IS NULL;`
    );

    if (hangoutRows.length === 0) {
      return;
    };

    const hangoutIdsToProgress: string[] = hangoutRows.map((hangout: HangoutDetails) => hangout.hangout_id);

    await dbPool.query<ResultSetHeader>(
      `UPDATE
        hangouts
      SET
        voting_period = (${currentTimestamp} - created_on_timestamp - availability_period - suggestions_period),
        current_stage = ${HANGOUT_CONCLUSION_STAGE},
        stage_control_timestamp = ?,
        is_concluded = ?
      WHERE
        hangout_id IN (?);`,
      [currentTimestamp, true, hangoutIdsToProgress]
    );

    interface HangoutMemberDetails extends RowDataPacket {
      hangout_member_id: number,
    };

    const [hangoutMemberRows] = await dbPool.query<HangoutMemberDetails[]>(
      `SELECT
        hangout_member_id
      FROM
        hangout_members
      WHERE
        hangout_id IN (?);`,
      [hangoutIdsToProgress]
    );

    const webSocketData = {
      type: 'hangoutStageUpdate',
      reason: 'noSuggestionConclusion',
      data: { currentTimestamp },
    };

    for (const member of hangoutMemberRows) {
      const ws: WebSocket | undefined = hangoutClients.get(member.hangout_member_id)?.ws;

      if (!ws) {
        continue;
      };

      ws.send(JSON.stringify(webSocketData), (err: Error | undefined) => err && console.log(err));
    };

    const eventDescription: string = 'Hangout reached the voting stage without any suggestions and was therefore automatically concluded.';
    let hangoutEventRowValuesString: string = '';

    for (const id of hangoutIdsToProgress) {
      hangoutEventRowValuesString += `('${id}', '${eventDescription}', ${currentTimestamp}),`;
    };
    hangoutEventRowValuesString = hangoutEventRowValuesString.slice(0, -1);

    await dbPool.execute(
      `INSERT INTO hangout_events (
        hangout_id,
        event_description,
        event_timestamp
      ) VALUES ${hangoutEventRowValuesString};`
    );

  } catch (err: any) {
    console.log(`CRON JOB ERROR: ${concludeNoSuggestionHangouts.name}`);
    console.log(err);
  };
};

export async function deleteNoMemberHangouts(): Promise<void> {
  await dbPool.execute(
    `DELETE FROM
    hangouts
      WHERE
    NOT EXISTS (
      SELECT
        1 AS members_exist
      FROM
        hangout_members
      WHERE
        hangout_members.hangout_id = hangouts.hangout_id
    );`
  );
};