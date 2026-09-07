import { NextRequest, NextResponse } from 'next/server';
import { redis } from '../../../lib/redis';

// key format: "YYYY-MM", e.g. "2026-09"
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }
  const data = await redis.get(`month-data-${key}`);
  return NextResponse.json({ data: data || {} });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { key, data } = body || {};
  if (!key || typeof data === 'undefined') {
    return NextResponse.json({ error: 'Missing key or data' }, { status: 400 });
  }
  await redis.set(`month-data-${key}`, data);
  return NextResponse.json({ ok: true });
}
