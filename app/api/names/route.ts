import { NextResponse } from 'next/server';
import { redis } from '../../../lib/redis';

const DEFAULT_NAMES = ['Person 1', 'Person 2', 'Person 3'];

export async function GET() {
  const names = await redis.get<string[]>('profile-names');
  return NextResponse.json({ names: names && names.length === 3 ? names : DEFAULT_NAMES });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { names } = body || {};
  if (!Array.isArray(names) || names.length !== 3) {
    return NextResponse.json({ error: 'names must be an array of 3 strings' }, { status: 400 });
  }
  await redis.set('profile-names', names);
  return NextResponse.json({ ok: true });
}
