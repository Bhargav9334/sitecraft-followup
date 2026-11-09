'use client';
import { useState } from 'react';
import { C } from '../theme';
import { Button, inputStyle } from '../ui';
import { fmtDate } from '@/lib/format';

export default function HolidaysEditor({ holidays, onChange }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [showPast, setShowPast] = useState(false);
  const visible = holidays.filter((h) => showPast || h.date >= today);

  function add() {
    if (!date) return;
    onChange([...holidays.filter((h) => h.date !== date), { date, name: name.trim() || 'Holiday' }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate('');
    setName('');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="date" aria-label="Holiday date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, width: 170 }} />
        <input aria-label="Holiday name" placeholder="Name (e.g. Holi)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, width: 220 }} />
        <Button variant="secondary" onClick={add} disabled={!date}>
          + Add
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 10 }}>
        {visible.length === 0 && <p style={{ margin: 0, padding: 14, fontSize: 13, color: C.sub }}>No upcoming holidays.</p>}
        {visible.map((h) => (
          <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, opacity: h.date < today ? 0.55 : 1 }}>
            <span style={{ width: 120, fontSize: 13, fontWeight: 600 }}>{fmtDate(h.date + 'T12:00:00+05:30')}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{h.name}</span>
            <button type="button" aria-label={`Remove ${h.name}`} onClick={() => onChange(holidays.filter((x) => x.date !== h.date))} style={{ border: 0, background: 'transparent', color: C.red, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
              Remove
            </button>
          </div>
        ))}
      </div>
      <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13, color: C.sub }}>
        <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past dates
      </label>
    </div>
  );
}
