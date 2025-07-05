import request, { Response as SuperTestResponse } from 'supertest';
import { app } from '../../src/app';
import { dbPool } from '../../src/db/db';
import { RowDataPacket } from 'mysql2';
import * as authSessionModule from '../../src/auth/authSessions';
import * as cookeUtils from '../../src/util/cookieUtils';

beforeEach(async () => {
  interface TableNames extends RowDataPacket {
    table_name: string,
  };

  const [tableRows] = await dbPool.execute<TableNames[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = ?;`,
    [process.env.TEST_DATABASE_NAME]
  );

  let clearDatabaseStatement: string = '';

  for (const row of tableRows) {
    clearDatabaseStatement += `DELETE FROM ${row.table_name};`;
  };

  await dbPool.query(clearDatabaseStatement);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('POST auth/signOut', () => {
  it('should reject requests if an authSessionId cookie is not found', async () => {
    const response: SuperTestResponse = await request(app)
      .post('/api/auth/signOut')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toBe('Not signed in.');
  });

  it('should accept the request, remove the authSessionId cookie, and destroy the auth session', async () => {
    const removeRequestCookieSpy = jest.spyOn(cookeUtils, 'removeRequestCookie');
    const destroyAuthSessionSpy = jest.spyOn(authSessionModule, 'destroyAuthSession');

    const response: SuperTestResponse = await request(app)
      .post('/api/auth/signOut')
      .set('Cookie', `authSessionId=invalidId`)
      .send({});

    expect(response.status).toBe(200);

    expect(removeRequestCookieSpy).toHaveBeenCalled();
    expect(destroyAuthSessionSpy).toHaveBeenCalled();
  });
});