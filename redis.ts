import { Redis } from '@upstash/redis';

// Vercel's Redis Marketplace integration (Upstash) injects these two
// environment variables automatically once connected to the project.
export const redis = Redis.fromEnv();
