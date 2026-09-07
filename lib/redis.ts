import { Redis } from '@upstash/redis';

// The Upstash-for-Redis integration on Vercel currently names its
// REST credentials KV_REST_API_URL / KV_REST_API_TOKEN (legacy naming),
// so we build the client from those directly instead of Redis.fromEnv().
export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});
