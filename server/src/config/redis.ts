import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL for BullMQ connection options
const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const isTls = parsed.protocol === 'rediss:';
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      // BullMQ: do not throw on connection failure — keep retrying silently
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: true,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    };
  } catch (e) {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null, enableOfflineQueue: true, lazyConnect: true };
  }
};

export const bullConfig = {
  connection: parseRedisUrl(REDIS_URL),
};

export const redisClient = createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Give up after 3 retries to avoid blocking server startup
      if (retries > 3) return false;
      return Math.min(retries * 500, 2000);
    },
  },
});

redisClient.on('error', (err) =>
  console.warn('[Redis] Connection error (non-fatal, queue features disabled):', err.message)
);

export const connectRedis = async (): Promise<void> => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log('Redis Cache connection established.');
    }
  } catch (error: any) {
    // Non-fatal: server continues without Redis; BullMQ queues will be unavailable
    console.warn('[Redis] Could not connect — background job queues will be disabled.', error.message);
  }
};
