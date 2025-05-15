import request from 'supertest';
import { app } from '../../src/app';

describe('POST /signUp', () => {
  beforeEach(async () => {
    process.env.DATABASE_NAME = process.env.TEST_DATABASE_NAME;
  });

  it('should reject empty body.', async () => {
    const response = await request(app)
      .post(`/api/accounts/signUp`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
    expect(typeof response.body.message === 'string').toBe(true);
    expect(response.body.message).toBe('Invalid request data.');
  });
})