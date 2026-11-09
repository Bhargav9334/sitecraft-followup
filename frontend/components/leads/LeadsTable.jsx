'use client';
import Link from 'next/link';
import { C } from '../theme';
import { StatusBadge, StepBars, Avatar, Button, th, td } from '../ui';
import { relDay, fmtDate } from '@/lib/format';

function nextText(l) {
  if (l.status === 'queued' || l.status === 'active') return `Email ${l.step + 1}${l.step === 0 && l.firstMessage ? ' (own)' : ''} · ${relDay(l.nextSendAt)}`;
  if (l.status === 'replied') return `Replied ${fmtDate(l.repliedAt)}`;
  if (l.status === 'unsubscribed') return `Unsubscribed ${fmtDate(l.unsubscribedAt)}`;
  if (l.status === 'completed') return 'Sequence finished';
  if (l.status === 'stopped') return l.stopReason || 'Stopped';
  if (l.status === 'bounced') return 'Email bounced';
  return '—';
}

export default function LeadsTable({ items, totalSteps, selected, onToggle, onToggleAll, onStop, onResume, busyId }) {
  const allOn = items.length > 0 && items.every((l) => selected.has(l.id));
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 40 }}>
              <input type="checkbox" aria-label="Select all" checked={allOn} onChange={onToggleAll} style={{ width: 16, height: 16 }} />
            </th>
            <th style={th}>Lead</th>
            <th style={th}>Email</th>
            <th style={th}>Emails sent</th>
            <th style={th}>Status</th>
            <th style={th}>Next / info</th>
            <th style={{ ...th, textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => {
            const canStop = l.status === 'queued' || l.status === 'active';
            const canResume = (l.status === 'stopped' || l.status === 'replied' || l.status === 'completed') && l.step < totalSteps;
            return (
              <tr key={l.id} style={{ background: selected.has(l.id) ? '#F8F9FF' : C.white }}>
                <td style={td}>
                  <input type="checkbox" aria-label={`Select ${l.email}`} checked={selected.has(l.id)} onChange={() => onToggle(l.id)} style={{ width: 16, height: 16 }} />
                </td>
                <td style={td}>
                  <Link href={`/leads/${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                    <Avatar name={l.name || l.company} email={l.email} size={32} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: 14 }}>{l.company || l.name || '—'}</span>
                      <span style={{ display: 'block', fontSize: 12, color: C.sub }}>{[l.name && l.company ? l.name : '', l.city].filter(Boolean).join(' · ') || ' '}</span>
                    </span>
                  </Link>
                </td>
                <td style={{ ...td, fontSize: 13 }}>{l.email}</td>
                <td style={td}>
                  <StepBars step={l.step} total={totalSteps} status={l.status} repliedAfterStep={l.repliedAfterStep} />
                </td>
                <td style={td}>
                  <StatusBadge status={l.status} />
                </td>
                <td style={{ ...td, fontSize: 13, color: C.sub }}>{nextText(l)}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {canStop && (
                    <Button variant="secondary" size="sm" onClick={() => onStop(l)} disabled={busyId === l.id}>
                      Stop
                    </Button>
                  )}
                  {canResume && (
                    <Button variant="secondary" size="sm" onClick={() => onResume(l)} disabled={busyId === l.id}>
                      Resume
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
