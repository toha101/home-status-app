'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Status = 'home' | 'away' | null;
type Source = 'manual' | 'quick' | 'automatic' | null;
type Theme = 'light' | 'dark' | 'pink' | 'ocean';

interface DayStatus {
  status: Status;
  updatedAt: string | null;
  returnTime: string | null;
  source?: Source;
}

type DayEntry = [DayStatus, DayStatus, DayStatus];
type MonthDays = Record<string, DayEntry>;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];
const WEEKDAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DEFAULT_NAMES: [string, string, string] = ['Person 1', 'Person 2', 'Person 3'];

const blankStatus = (): DayStatus => ({ status: null, updatedAt: null, returnTime: null, source: null });
const blankDay = (): DayEntry => [blankStatus(), blankStatus(), blankStatus()];

function pad(n: number) { return n < 10 ? '0' + n : '' + n; }
function dayKey(d: number) { return pad(d); }
function monthKey(y: number, m: number) { return `${y}-${pad(m + 1)}`; }

function formatClock(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatSince(iso: string | null, now: Date) {
  if (!iso) return '';
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return time;
  if (d.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
}

function formatUpdated(iso: string | null, now: Date) {
  if (!iso) return 'No recent update';
  const d = new Date(iso);
  const diffMin = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  if (diffMin < 1) return 'Updated just now';
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `Updated ${diffHr}h ago`;
  return `Updated ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function formatReturnTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getOverdueLabel(returnTime: string | null, isToday: boolean, now: Date): string | null {
  if (!returnTime || !isToday) return null;
  const [h, m] = returnTime.split(':').map(Number);
  const expected = new Date(now);
  expected.setHours(h, m, 0, 0);
  if (now <= expected) return null;
  const diffMin = Math.round((now.getTime() - expected.getTime()) / 60000);
  const hrs = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (hrs === 0) return `${mins}m past expected return`;
  if (mins === 0) return `${hrs}h past expected return`;
  return `${hrs}h ${mins}m past expected return`;
}

function sourceLabel(source?: Source) {
  if (source === 'automatic') return 'Automatic';
  if (source === 'quick') return 'Quick update';
  if (source === 'manual') return 'Manual';
  return null;
}

export default function Home() {
  const initialToday = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(initialToday.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialToday.getMonth());
  const [selectedDay, setSelectedDay] = useState(initialToday.getDate());

  const [names, setNames] = useState<[string, string, string]>(DEFAULT_NAMES);
  const [monthDays, setMonthDays] = useState<MonthDays>({});
  const [currentPresence, setCurrentPresence] = useState<DayEntry>(blankDay());
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<Status>(null);
  const [draftReturnTime, setDraftReturnTime] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [myProfile, setMyProfile] = useState<number | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const [timeZone, setTimeZone] = useState('UTC');
  const [copied, setCopied] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');

  const today = now;
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();
  const isCurrentMonth = viewYear === currentYear && viewMonth === currentMonth;
  const isSelToday = isCurrentMonth && selectedDay === currentDay;

  useEffect(() => {
    setOrigin(window.location.origin);
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const stored = window.localStorage.getItem('home-status-my-profile');
    if (stored !== null) {
      const parsed = Number(stored);
      if ([0, 1, 2].includes(parsed)) setMyProfile(parsed);
    }

    const storedTheme = window.localStorage.getItem('home-status-theme');
    const allowedThemes: Theme[] = ['light', 'dark', 'pink', 'ocean'];
    const nextTheme = allowedThemes.includes(storedTheme as Theme) ? storedTheme as Theme : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem('home-status-theme', nextTheme);
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch('/api/names')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.names) && d.names.length === 3) setNames(d.names); })
      .catch(() => { /* keep defaults */ });
  }, []);

  const loadCurrent = useCallback(async () => {
    try {
      const res = await fetch('/api/current', { cache: 'no-store' });
      const d = await res.json();
      if (Array.isArray(d.data) && d.data.length === 3) {
        setCurrentPresence(d.data as DayEntry);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  const loadMonth = useCallback(async (y: number, m: number, showLoader = false) => {
    if (showLoader) setMonthLoaded(false);
    try {
      const res = await fetch(`/api/month?key=${monthKey(y, m)}`, { cache: 'no-store' });
      const d = await res.json();
      setMonthDays(d.data || {});
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      if (showLoader) setMonthLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadMonth(viewYear, viewMonth, true);
  }, [viewYear, viewMonth, loadMonth]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  // Keep the live household dashboard fresh when other phones update it.
  useEffect(() => {
    const interval = setInterval(() => {
      if (editingIndex === null && !saving) {
        loadCurrent();
        if (isCurrentMonth) loadMonth(viewYear, viewMonth, false);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [editingIndex, isCurrentMonth, loadCurrent, loadMonth, saving, viewMonth, viewYear]);

  const getDayEntry = useCallback((d: number): DayEntry => {
    const existing = monthDays[dayKey(d)];
    if (!existing || !Array.isArray(existing)) return blankDay();
    return existing as DayEntry;
  }, [monthDays]);

  async function persistMonth(nextMonthDays: MonthDays) {
    setSaving(true);
    try {
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: monthKey(viewYear, viewMonth), data: nextMonthDays }),
      });
      setLoadError(!res.ok);
    } catch {
      setLoadError(true);
    }
    setSaving(false);
  }

  async function renameProfile(index: number) {
    const newName = prompt('Name for this profile:', names[index]);
    if (newName && newName.trim()) {
      const next = [...names] as [string, string, string];
      next[index] = newName.trim();
      setNames(next);
      try {
        await fetch('/api/names', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ names: next }),
        });
      } catch { /* non-fatal */ }
    }
  }

  function chooseMyProfile(index: number) {
    setMyProfile(index);
    window.localStorage.setItem('home-status-my-profile', String(index));
  }

  function openEdit(index: number) {
    const entry = currentPresence[index] || blankStatus();
    setEditingIndex(index);
    setDraftStatus(entry.status);
    setDraftReturnTime(entry.returnTime || '');
  }

  function closeEdit() { setEditingIndex(null); }

  async function saveEdit(index: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: index,
          status: draftStatus,
          returnTime: draftStatus === 'away' ? (draftReturnTime || null) : null,
          source: 'manual',
          timeZone,
        }),
      });
      setLoadError(!res.ok);
      if (res.ok) {
        setEditingIndex(null);
        await Promise.all([loadCurrent(), loadMonth(currentYear, currentMonth, false)]);
      }
    } catch {
      setLoadError(true);
    }
    setSaving(false);
  }

  async function clearEntry(index: number) {
    setSaving(true);
    try {
      const res = await fetch('/api/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person: index, status: null, source: 'manual', timeZone }),
      });
      setLoadError(!res.ok);
      if (res.ok) {
        setEditingIndex(null);
        await Promise.all([loadCurrent(), loadMonth(currentYear, currentMonth, false)]);
      }
    } catch {
      setLoadError(true);
    }
    setSaving(false);
  }

  async function quickUpdate(status: 'home' | 'away') {
    if (myProfile === null) {
      setSetupOpen(true);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/presence?person=${myProfile}&status=${status}&tz=${encodeURIComponent(timeZone)}&source=quick`, {
        cache: 'no-store',
      });
      setLoadError(!res.ok);
      if (res.ok) {
        // Jump back to today so the result is immediately visible.
        setViewYear(currentYear);
        setViewMonth(currentMonth);
        setSelectedDay(currentDay);
        await Promise.all([loadCurrent(), loadMonth(currentYear, currentMonth, false)]);
      }
    } catch {
      setLoadError(true);
    }
    setSaving(false);
  }

  function goPrevMonth() {
    let y = viewYear, m = viewMonth - 1;
    if (m < 0) { m = 11; y -= 1; }
    setViewYear(y); setViewMonth(m); setSelectedDay(1); setEditingIndex(null);
  }

  function goNextMonth() {
    let y = viewYear, m = viewMonth + 1;
    if (m > 11) { m = 0; y += 1; }
    setViewYear(y); setViewMonth(m); setSelectedDay(1); setEditingIndex(null);
  }

  function goToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setEditingIndex(null);
  }

  async function copyText(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      prompt('Copy this:', text);
    }
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const liveDateObj = new Date(currentYear, currentMonth, currentDay);
  const weekdayLabel = WEEKDAY_FULL[liveDateObj.getDay()];
  const dateLabel = `${MONTH_NAMES[currentMonth]} ${currentDay}`;
  const selectedEntry = currentPresence;
  const homeCount = currentPresence.filter(s => s.status === 'home').length;
  const knownCount = currentPresence.filter(s => s.status !== null).length;

  const arrivalUrl = myProfile !== null && origin
    ? `${origin}/api/presence?person=${myProfile}&status=home&tz=${encodeURIComponent(timeZone)}&source=automatic`
    : '';
  const leaveUrl = myProfile !== null && origin
    ? `${origin}/api/presence?person=${myProfile}&status=away&tz=${encodeURIComponent(timeZone)}&source=automatic`
    : '';

  return (
    <main className="wrap">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Household presence</p>
          <h1>Who&apos;s home?</h1>
          <p className="hero-date">{weekdayLabel}, {dateLabel} · Today</p>
        </div>
        <div className="hero-side">
          <div className="summary-pill" aria-label={`${homeCount} people home`}>
            <strong>{homeCount}</strong>
            <span>{knownCount === 0 ? 'no updates' : `of 3 home`}</span>
          </div>
          <label className="theme-control">
            <span>Theme</span>
            <select value={theme} onChange={(e) => changeTheme(e.target.value as Theme)} aria-label="Choose color theme">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="pink">Pink</option>
              <option value="ocean">Ocean</option>
            </select>
          </label>
        </div>
      </header>

      <section className="profiles" aria-label="Household status">
        {[0, 1, 2].map(index => {
          const name = names[index];
          const s = selectedEntry[index] || blankStatus();
          const isEditing = editingIndex === index;
          const badgeClass = s.status === 'home' ? 'home' : s.status === 'away' ? 'away' : 'unset';
          const source = sourceLabel(s.source);
          const overdue = s.status === 'away' ? getOverdueLabel(s.returnTime, true, now) : null;

          return (
            <article className={`profile-card ${s.status || 'unset'}`} key={index}>
              <button className="profile-main" onClick={() => isEditing ? closeEdit() : openEdit(index)}>
                <span className={`presence-dot ${badgeClass}`} aria-hidden="true" />
                <span className="profile-copy">
                  <span className="profile-name-line">
                    <span className="profile-name">{name}</span>
                    {myProfile === index && <span className="me-chip">this phone</span>}
                  </span>
                  <span className="profile-status-line">
                    {s.status === 'home' && <>Home {s.updatedAt && <span>· since {formatSince(s.updatedAt, now)}</span>}</>}
                    {s.status === 'away' && <>Away {s.updatedAt && <span>· since {formatSince(s.updatedAt, now)}</span>}</>}
                    {!s.status && <>Status not set</>}
                  </span>
                  <span className="profile-detail-line">
                    {s.status && s.updatedAt ? formatUpdated(s.updatedAt, now) : 'Tap to update'}
                    {source ? ` · ${source}` : ''}
                  </span>
                  {s.status === 'away' && s.returnTime && (
                    <span className="return-line">Back around {formatReturnTime(s.returnTime)}</span>
                  )}
                  {overdue && <span className="overdue-note">{overdue}</span>}
                </span>
                <span className={`status-badge ${badgeClass}`}>
                  {s.status === 'home' ? 'Home' : s.status === 'away' ? 'Away' : 'Unknown'}
                </span>
              </button>

              <div className="card-tools">
                <button className="rename-btn" onClick={() => renameProfile(index)}>rename</button>
                <button className="device-btn" onClick={() => chooseMyProfile(index)}>
                  {myProfile === index ? 'This is my profile' : 'Use on this phone'}
                </button>
              </div>

              {isEditing && (
                <div className="edit-panel">
                  <p className="edit-title">Manual override for {name}</p>
                  <div className="status-toggle">
                    <button
                      className={`status-btn ${draftStatus === 'home' ? 'active home' : ''}`}
                      onClick={() => setDraftStatus('home')}
                    >I&apos;m home</button>
                    <button
                      className={`status-btn ${draftStatus === 'away' ? 'active away' : ''}`}
                      onClick={() => setDraftStatus('away')}
                    >I&apos;m away</button>
                  </div>

                  {draftStatus === 'away' && (
                    <div className="return-row">
                      <label htmlFor={`return-time-${index}`}>Back around</label>
                      <input
                        type="time"
                        id={`return-time-${index}`}
                        value={draftReturnTime}
                        onChange={(e) => setDraftReturnTime(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="edit-actions">
                    <button className="cancel-btn" onClick={closeEdit}>Cancel</button>
                    <button className="save-btn" disabled={saving || draftStatus === null} onClick={() => saveEdit(index)}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>

                  {s.status && (
                    <button className="clear-btn" onClick={() => clearEntry(index)}>Clear current status</button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="quick-card">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Fastest manual option</p>
            <h2>One-tap status</h2>
          </div>
          <button className="text-btn" onClick={() => setSetupOpen(!setupOpen)}>
            {setupOpen ? 'Hide setup' : 'Automatic setup'}
          </button>
        </div>

        {myProfile === null ? (
          <div className="choose-me">
            <p>First, tell this phone who it belongs to.</p>
            <div className="profile-picker">
              {names.map((name, index) => (
                <button key={index} onClick={() => chooseMyProfile(index)}>{name}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <p className="quick-person">This phone: <strong>{names[myProfile]}</strong></p>
            <div className="quick-actions">
              <button className="quick-home" disabled={saving} onClick={() => quickUpdate('home')}>⌂ I&apos;m home</button>
              <button className="quick-away" disabled={saving} onClick={() => quickUpdate('away')}>↗ I&apos;m leaving</button>
            </div>
          </>
        )}

        {setupOpen && (
          <div className="automation-panel">
            <div className="automation-head">
              <div>
                <p className="section-kicker">Hands-free mode</p>
                <h3>Automatic arrival &amp; leaving</h3>
              </div>
              <span className="privacy-chip">No live map</span>
            </div>

            <p className="automation-copy">
              Your phone can call this app automatically when you arrive at or leave home. The app receives only “home” or “away” — not a live GPS trail.
            </p>

            {myProfile === null ? (
              <p className="automation-warning">Choose “This phone” above first so I can generate the correct links.</p>
            ) : (
              <>
                <div className="automation-links">
                  <div className="automation-link-row">
                    <div>
                      <strong>Arrival link</strong>
                      <small>Marks {names[myProfile]} home</small>
                    </div>
                    <button onClick={() => copyText('arrival', arrivalUrl)}>{copied === 'arrival' ? 'Copied' : 'Copy'}</button>
                  </div>
                  <div className="automation-link-row">
                    <div>
                      <strong>Leaving link</strong>
                      <small>Marks {names[myProfile]} away</small>
                    </div>
                    <button onClick={() => copyText('leave', leaveUrl)}>{copied === 'leave' ? 'Copied' : 'Copy'}</button>
                  </div>
                </div>

                <ol className="shortcut-steps">
                  <li>Open <strong>Shortcuts</strong> on the iPhone and create a Personal Automation for <strong>Arrive</strong> at your home.</li>
                  <li>Add the action <strong>Get Contents of URL</strong>, paste the Arrival link, and set the automation to run automatically / immediately if your iPhone offers that option.</li>
                  <li>Create a second Personal Automation for <strong>Leave</strong>, using the Leaving link.</li>
                  <li>Repeat once on each household member&apos;s phone, choosing that person&apos;s profile first.</li>
                </ol>
                <p className="automation-footnote">Timezone used for these links: <strong>{timeZone}</strong></p>
              </>
            )}
          </div>
        )}
      </section>

      <section className="history-section">
        <button className="history-toggle" onClick={() => setHistoryOpen(!historyOpen)}>
          <span>
            <span className="section-kicker">Optional</span>
            <strong>History &amp; calendar</strong>
          </span>
          <span aria-hidden="true">{historyOpen ? '−' : '+'}</span>
        </button>

        {historyOpen && (
          <div className="calendar-card">
            <div className="cal-header">
              <div>
                <div className="month-label">{MONTH_NAMES[viewMonth]} {viewYear}</div>
                {!isSelToday && <button className="today-link" onClick={goToday}>Back to today</button>}
              </div>
              <div className="cal-nav">
                <button onClick={goPrevMonth} disabled={!monthLoaded} aria-label="Previous month">‹</button>
                <button onClick={goNextMonth} disabled={!monthLoaded} aria-label="Next month">›</button>
              </div>
            </div>

            {!monthLoaded ? (
              <p className="loading-msg">Loading…</p>
            ) : (
              <div className="cal-grid">
                {DOW.map((d, i) => <div className="cal-dow" key={i}>{d}</div>)}
                {cells.map((d, i) => {
                  if (d === null) return <div className="cal-day empty" key={i} />;
                  const isToday = isCurrentMonth && d === currentDay;
                  const isSelected = d === selectedDay;
                  const hasData = !!monthDays[dayKey(d)];
                  const cls = ['cal-day', isToday && 'today', isSelected && 'selected', hasData && 'has-data']
                    .filter(Boolean).join(' ');
                  return (
                    <button className={cls} key={i} onClick={() => { setSelectedDay(d); setEditingIndex(null); }}>
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {loadError && <p className="error-msg">Could not sync with the shared database. Check your connection and try again.</p>}
      {saving && <p className="saving-msg">Saving…</p>}

      <footer className="footer-note">
        Status updates are shared through your existing Redis database. Automatic mode records Home/Away, not a live location trail.
      </footer>
    </main>
  );
}
