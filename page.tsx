'use client';

import { useEffect, useState, useCallback } from 'react';

type Status = 'home' | 'away' | null;

interface DayStatus {
  status: Status;
  updatedAt: string | null;
  returnTime: string | null;
}

type DayEntry = [DayStatus, DayStatus, DayStatus];
type MonthDays = Record<string, DayEntry>;

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['S','M','T','W','T','F','S'];
const WEEKDAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DEFAULT_NAMES: [string, string, string] = ['Person 1', 'Person 2', 'Person 3'];

const blankStatus = (): DayStatus => ({ status: null, updatedAt: null, returnTime: null });
const blankDay = (): DayEntry => [blankStatus(), blankStatus(), blankStatus()];

function pad(n: number) { return n < 10 ? '0' + n : '' + n; }
function dayKey(d: number) { return pad(d); }
function monthKey(y: number, m: number) { return `${y}-${pad(m + 1)}`; }

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return 'today at ' + time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + time;
}

function formatReturnTime(t: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function Home() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const [names, setNames] = useState<[string, string, string]>(DEFAULT_NAMES);
  const [monthDays, setMonthDays] = useState<MonthDays>({});
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<Status>(null);
  const [draftReturnTime, setDraftReturnTime] = useState('');

  const getDayEntry = useCallback((d: number): DayEntry => {
    return monthDays[dayKey(d)] || blankDay();
  }, [monthDays]);

  // Load profile names once
  useEffect(() => {
    fetch('/api/names')
      .then(r => r.json())
      .then(d => { if (d.names) setNames(d.names); })
      .catch(() => { /* keep defaults */ });
  }, []);

  // Load whichever month is in view
  useEffect(() => {
    let cancelled = false;
    setMonthLoaded(false);
    fetch(`/api/month?key=${monthKey(viewYear, viewMonth)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        setMonthDays(d.data || {});
        setMonthLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setMonthDays({});
        setMonthLoaded(true);
      });
    return () => { cancelled = true; };
  }, [viewYear, viewMonth]);

  async function persistMonth(nextMonthDays: MonthDays) {
    setSaving(true);
    try {
      const res = await fetch('/api/month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: monthKey(viewYear, viewMonth), data: nextMonthDays }),
      });
      setLoadError(!res.ok);
    } catch (e) {
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
      } catch (e) { /* non-fatal */ }
    }
  }

  function openEdit(index: number) {
    const entry = getDayEntry(selectedDay)[index];
    setEditingIndex(index);
    setDraftStatus(entry.status);
    setDraftReturnTime(entry.returnTime || '');
  }

  function closeEdit() { setEditingIndex(null); }

  async function saveEdit(index: number) {
    const key = dayKey(selectedDay);
    const entry: DayEntry = monthDays[key] ? [...monthDays[key]] as DayEntry : blankDay();
    entry[index] = {
      status: draftStatus,
      updatedAt: new Date().toISOString(),
      returnTime: draftStatus === 'away' ? (draftReturnTime || null) : null,
    };
    const next = { ...monthDays, [key]: entry };
    setMonthDays(next);
    setEditingIndex(null);
    await persistMonth(next);
  }

  async function clearEntry(index: number) {
    const key = dayKey(selectedDay);
    const entry: DayEntry = monthDays[key] ? [...monthDays[key]] as DayEntry : blankDay();
    entry[index] = blankStatus();
    const next = { ...monthDays };
    if (entry.some(s => s.status)) next[key] = entry;
    else delete next[key];
    setMonthDays(next);
    setEditingIndex(null);
    await persistMonth(next);
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

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selDateObj = new Date(viewYear, viewMonth, selectedDay);
  const weekdayLabel = WEEKDAY_FULL[selDateObj.getDay()];
  const dateLabel = `${MONTH_NAMES[viewMonth]} ${selectedDay}`;
  const isSelToday = isCurrentMonth && selectedDay === today.getDate();

  return (
    <div className="wrap">
      <p className="eyebrow">Household status</p>
      <h1>Who&apos;s home</h1>

      {!monthLoaded ? (
        <p className="loading-msg sans">Loading…</p>
      ) : (
        <>
          <p className="selected-date-heading">{weekdayLabel}, {dateLabel}{isSelToday ? ' · Today' : ''}</p>
          <p className="selected-date-sub">Status for this day only — pick another date and this resets.</p>

          <div className="profiles">
            {[0, 1, 2].map(index => {
              const name = names[index];
              const s = getDayEntry(selectedDay)[index];
              const badgeClass = s.status === 'home' ? 'home' : s.status === 'away' ? 'away' : 'unset';
              const badgeText = s.status === 'home' ? 'Home' : s.status === 'away' ? 'Away' : 'Not set';
              const isEditing = editingIndex === index;

              return (
                <div className={`profile-card ${s.status || ''}`} key={index}>
                  <div className="profile-top" onClick={() => (isEditing ? closeEdit() : openEdit(index))}>
                    <div className="profile-name-row">
                      <span className="profile-name">{name}</span>
                      <button className="rename-btn" onClick={(e) => { e.stopPropagation(); renameProfile(index); }}>
                        rename
                      </button>
                    </div>
                    <span className={`badge ${badgeClass}`}>{badgeText}</span>
                  </div>

                  {s.status && s.updatedAt && (
                    <p className="profile-meta">
                      {name} marked {s.status === 'home' ? 'home' : 'away'} — {formatTime(s.updatedAt)}
                      {s.status === 'away' && s.returnTime && (
                        <><br />Back around {formatReturnTime(s.returnTime)}</>
                      )}
                    </p>
                  )}

                  {isEditing && (
                    <div className="edit-panel">
                      <div className="status-toggle">
                        <button
                          className={`status-btn ${draftStatus === 'home' ? 'active home' : ''}`}
                          onClick={() => setDraftStatus('home')}
                        >Home</button>
                        <button
                          className={`status-btn ${draftStatus === 'away' ? 'active away' : ''}`}
                          onClick={() => setDraftStatus('away')}
                        >Away</button>
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
                        <button className="save-btn" disabled={saving} onClick={() => saveEdit(index)}>
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                      {s.status && (
                        <button className="clear-btn" onClick={() => clearEntry(index)}>Clear this entry</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {loadError && <p className="error-msg">Could not save — check your connection and try again.</p>}
          {saving && <p className="saving-msg">Saving…</p>}
        </>
      )}

      <div className="calendar-card">
        <div className="cal-header">
          <div className="month-label">{MONTH_NAMES[viewMonth]} {viewYear}</div>
          <div className="cal-nav">
            <button onClick={goPrevMonth} disabled={!monthLoaded}>‹</button>
            <button onClick={goNextMonth} disabled={!monthLoaded}>›</button>
          </div>
        </div>
        <div className="cal-grid">
          {DOW.map((d, i) => <div className="cal-dow" key={i}>{d}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div className="cal-day empty" key={i} />;
            const isToday = isCurrentMonth && d === today.getDate();
            const isSelected = d === selectedDay;
            const hasData = monthLoaded && !!monthDays[dayKey(d)];
            const cls = ['cal-day', isToday && 'today', isSelected && 'selected', hasData && 'has-data']
              .filter(Boolean).join(' ');
            return (
              <div className={cls} key={i} onClick={() => { setSelectedDay(d); setEditingIndex(null); }}>
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {monthLoaded && (
        <p className="note">
          Tap a date above to check or set that day&apos;s status. Days with a small dot already have entries saved.
          Tap &quot;rename&quot; once to put in real names — that applies to every day.
        </p>
      )}
    </div>
  );
}
