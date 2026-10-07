import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

type Status = 'home' | 'away';
type Source = 'automatic' | 'quick';

interface DayStatus {
  status: Status | null;
  updatedAt: string | null;
  returnTime: string | null;
  source?: 'manual' | Source | null;
}

type DayEntry = [DayStatus, DayStatus, DayStatus];
type MonthDays = Record<string, DayEntry>;

const blankStatus = (): DayStatus => ({ status: null, updatedAt: null, returnTime: null, source: null });
const blankDay = (): DayEntry => [blankStatus(), blankStatus(), blankStatus()];

function getLocalDateParts(date: Date, requestedTimeZone?: string | null) {
  let timeZone = requestedTimeZone || 'UTC';

  try {
    // Throws for an invalid IANA timezone, letting us safely fall back to UTC.
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
  } catch {
    timeZone = 'UTC';
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value || '';
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    timeZone,
  };
}

async function applyPresence(person: number, status: Status, requestedTimeZone?: string | null, source: Source = 'automatic') {
  if (!Number.isInteger(person) || person < 0 || person > 2) {
    return { ok: false as const, statusCode: 400, error: 'person must be 0, 1, or 2' };
  }

  if (status !== 'home' && status !== 'away') {
    return { ok: false as const, statusCode: 400, error: 'status must be home or away' };
  }

  const now = new Date();
  const local = getLocalDateParts(now, requestedTimeZone);
  const monthKey = `${local.year}-${local.month}`;
  const redisKey = `month-data-${monthKey}`;
  const monthDays = (await redis.get<MonthDays>(redisKey)) || {};

  const existing = monthDays[local.day];
  const entry: DayEntry = existing && Array.isArray(existing)
    ? ([...existing] as DayEntry)
    : blankDay();

  entry[person] = {
    status,
    updatedAt: now.toISOString(),
    returnTime: null,
    source,
  };

  monthDays[local.day] = entry;
  await redis.set(redisKey, monthDays);

  // Keep a separate live snapshot so the dashboard does not reset at midnight.
  const currentKey = 'current-presence';
  const current = (await redis.get<DayEntry>(currentKey)) || blankDay();
  current[person] = entry[person];
  await redis.set(currentKey, current);

  return {
    ok: true as const,
    person,
    status,
    updatedAt: now.toISOString(),
    monthKey,
    day: local.day,
    timeZone: local.timeZone,
  };
}

// GET exists intentionally so iPhone/Android automation apps can trigger a status
// with one simple "Get contents of URL" action.
export async function GET(req: NextRequest) {
  const person = Number(req.nextUrl.searchParams.get('person'));
  const status = req.nextUrl.searchParams.get('status') as Status;
  const timeZone = req.nextUrl.searchParams.get('tz');
  const sourceParam = req.nextUrl.searchParams.get('source');
  const source: Source = sourceParam === 'quick' ? 'quick' : 'automatic';

  const result = await applyPresence(person, status, timeZone, source);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const person = Number(body?.person);
  const status = body?.status as Status;
  const timeZone = typeof body?.timeZone === 'string' ? body.timeZone : null;
  const source: Source = body?.source === 'quick' ? 'quick' : 'automatic';

  const result = await applyPresence(person, status, timeZone, source);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode });
  }
  return NextResponse.json(result);
}
