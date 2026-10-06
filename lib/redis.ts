import { Redis } from '@upstash/redis';

// Supports both the current Upstash/Vercel Marketplace variable names
// and the older Vercel KV variable names, so an existing deployment can
// keep using the database it already has connected.
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  throw new Error(
    'Redis environment variables are missing. Expected UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.'
  );
}

export const redis = new Redis({ url, token });
