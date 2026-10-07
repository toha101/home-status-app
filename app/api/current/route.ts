import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

type Status = 'home' | 'away' | null;
type Source = 'manual' | 'quick' | 'automatic' | null;

interface PresenceStatus {
  status: Status;
  updatedAt: string | null;
  returnTime: string | null;
  source?: Source;
}

type CurrentPresence = [PresenceStatus, PresenceStatus, PresenceStatus];
type MonthDays = Record<string, CurrentPresence>;

const blankStatus = (): PresenceStatus => ({ status: null, updatedAt: null, returnTime: null, source: null });
const blankCurrent = (): CurrentPresence => [blankStatus(), blankStatus(), blankStatus()];

function isNewer(a: PresenceStatus, b: PresenceStatus) {
  if (!a.updatedAt) return false;
  if (!b.updatedAt) return true;
  return new Date(a.updatedAt).getTime() > new Date(b.updatedAt).getTime();
}

function getLocalDateParts(date: Date, requestedTimeZone?: string | null) {
  let timeZone = requestedTimeZone || 'UTC';
  try {
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
  return { year: value('year'), month: value('month'), day: value('day'), timeZone };
}

function monthKeysAroundNow() {
  const now = new Date();
  const keys: string[] = [];
  for (let offset = -2; offset <= 1; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

async function deriveLatestFromHistory(): Promise<CurrentPresence> {
  const latest = blankCurrent();
  for (const key of monthKeysAroundNow()) {
    const month = (await redis.get<MonthDays>(`month-data-${key}`)) || {};
    for (const entry of Object.values(month)) {
      if (!Array.isArray(entry)) continue;
      entry.forEach((candidate, index) => {
        if (candidate && candidate.status && isNewer(candidate, latest[index])) latest[index] = candidate;
      });
    }
  }
  return latest;
}

export async function GET() {
  const stored = await redis.get<CurrentPresence>('current-presence');
  const history = await deriveLatestFromHistory();
  const merged = blankCurrent();

  for (let i = 0; i < 3; i++) {
    const fromStored = Array.isArray(stored) ? stored[i] : null;
    const fromHistory = history[i];
    if (fromStored?.status && !isNewer(fromHistory, fromStored)) merged[i] = fromStored;
    else if (fromHistory?.status) merged[i] = fromHistory;
  }

  // Automatic migration from the old day-only model.
  await redis.set('current-presence', merged);
  return NextResponse.json({ data: merged });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const person = Number(body?.person);
  const status = body?.status as Status;
  const now = new Date();
  const updatedAt = typeof body?.updatedAt === 'string' ? body.updatedAt : now.toISOString();
  const returnTime = typeof body?.returnTime === 'string' && body.returnTime ? body.returnTime : null;
  const source: Source = ['manual', 'quick', 'automatic'].includes(body?.source) ? body.source : 'manual';
  const timeZone = typeof body?.timeZone === 'string' ? body.timeZone : null;

  if (!Number.isInteger(person) || person < 0 || person > 2) {
    return NextResponse.json({ error: 'person must be 0, 1, or 2' }, { status: 400 });
  }
  if (status !== 'home' && status !== 'away' && status !== null) {
    return NextResponse.json({ error: 'status must be home, away, or null' }, { status: 400 });
  }

  const nextStatus: PresenceStatus = status
    ? { status, updatedAt, returnTime: status === 'away' ? returnTime : null, source }
    : blankStatus();

  const current = (await redis.get<CurrentPresence>('current-presence')) || blankCurrent();
  current[person] = nextStatus;
  await redis.set('current-presence', current);

  // Also keep today's calendar/history record in sync.
  const local = getLocalDateParts(now, timeZone);
  const monthKey = `${local.year}-${local.month}`;
  const redisKey = `month-data-${monthKey}`;
  const monthDays = (await redis.get<MonthDays>(redisKey)) || {};
  const entry = monthDays[local.day] && Array.isArray(monthDays[local.day])
    ? ([...monthDays[local.day]] as CurrentPresence)
    : blankCurrent();
  entry[person] = nextStatus;
  monthDays[local.day] = entry;
  await redis.set(redisKey, monthDays);

  return NextResponse.json({ ok: true, data: current, monthKey, day: local.day, timeZone: local.timeZone });
}
