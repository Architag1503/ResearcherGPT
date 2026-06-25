import request from 'supertest';
import app from '../server.js';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis.js';

describe('Project Gateway API Verification', () => {
  beforeAll(async () => {
    // Wait for DB connections to stabilize
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    // Close connections to prevent hanging handles
    await mongoose.connection.close();
    if (redisClient.isOpen) {
      await redisClient.disconnect();
    }
  });

  it('should ping base route successfully', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'healthy');
  });

  it('should list projects with mock auth bypass', async () => {
    const res = await request(app).get('/api/projects');
    // In dev, lists either empty array or seeded items
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
