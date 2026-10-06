import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

const DEFAULT_NAMES = ['Person 1', 'Person 2', 'Person 3'];

export async function GET() {
  const names = await redis.get<string[]>('profile-names');
  return NextResponse.json({ names: names || DEFAULT_NAMES });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const names = body?.names;

  if (!Array.isArray(names) || names.length !== 3 || names.some(name => typeof name !== 'string' || !name.trim())) {
    return NextResponse.json({ error: 'Expected exactly three non-empty names.' }, { status: 400 });
  }

  const cleaned = names.map(name => name.trim().slice(0, 40));
  await redis.set('profile-names', cleaned);
  return NextResponse.json({ ok: true, names: cleaned });
}
