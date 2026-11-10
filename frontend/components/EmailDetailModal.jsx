'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C } from './theme';
import { Modal, Badge, StatusBadge, Alert, Loading, buttonStyle } from './ui';
import { api } from '@/lib/api';
import { fmtDateTime, relDay } from '@/lib/format';

function Info({ label, value, href }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13, padding: '5px 0' }}>
      <span style={{ width: 78, flexShrink: 0, color: C.muted }}>{label}</span>
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
            {value}
          </a>
        ) : (
          value
        )}
      </span>
    </div>
  );
}

/**
 * Full details of one email for one lead: who it goes to (all lead details)
 * and the exact subject + message. Sent emails show what was really sent;
 * future emails show a live preview with the current Sequence/Settings.
 * step is 1-based.
 */
export default function EmailDetailModal({ open, onClose, leadId, step }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !leadId || !step) return;
    let alive = true;
    setData(null);
    setError('');
    (async () => {
      try {
        const d = await api(`/api/leads/${leadId}`);
        const { lead, logs, totalSteps } = d;
        const sentLog = logs.find((l) => l.direction === 'out' && l.status === 'sent' && l.step === step);
        const failed = logs.filter((l) => l.direction === 'out' && l.status === 'failed' && l.step === step).pop();
        let mail;
        let state;
        let at = null;
        if (sentLog) {
          mail = { subject: sentLog.subject, text: sentLog.text || '' };
          state = 'sent';
          at = sentLog.at;
        } else {
          const p = await api('/api/sequence/preview', { method: 'POST', body: { leadId, index: step - 1 } });
          mail = { subject: p.subject, text: p.text, from: p.from };
          const running = lead.status === 'queued' || lead.status === 'active';
          if (running && step === lead.step + 1) {
            state = 'next';
            at = lead.nextSendAt;
          } else if (running && step > lead.step) state = 'pending';
          else state = 'cancelled';
        }
        if (alive) setData({ lead, totalSteps, mail, state, at, failed, ownFirst: step === 1 && Boolean(lead.firstMessage) });
      } catch (e) {
        if (alive) setError(e.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, leadId, step]);

  const stateBadge = data && {
    sent: { fg: C.accent, bg: C.accentSoft, text: `Sent · ${fmtDateTime(data.at)}` },
    next: { fg: C.green, bg: C.greenSoft, text: `Next · ${relDay(data.at)}` },
    pending: { fg: C.sub, bg: '#EEF0F3', text: 'Will be sent later (after the earlier emails)' },
    cancelled: { fg: C.red, bg: C.redSoft, text: 'Will not be sent' },
  }[data.state];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Email ${step || ''} — full details`}
      width={680}
      footer={
        <>
          {leadId && (
            <Link href={`/leads/${leadId}`} style={buttonStyle('secondary', 'md')} onClick={onClose}>
              Open lead page
            </Link>
          )}
          <button type="button" onClick={onClose} style={buttonStyle('primary', 'md')}>
            Close
          </button>
        </>
      }
    >
      {error ? (
        <Alert>{error}</Alert>
      ) : !data ? (
        <Loading text="Loading email…" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Badge fg={stateBadge.fg} bg={stateBadge.bg}>
              {stateBadge.text}
            </Badge>
            <Badge>
              Email {step} of {data.totalSteps}
            </Badge>
            {step === 1 && <Badge>{data.ownFirst ? 'Own message from the CSV' : 'Default Email 1 (Sequence page)'}</Badge>}
            {step > 1 && <Badge>Follow-up · same Gmail thread</Badge>}
          </div>

          {data.failed && data.state !== 'sent' && <Alert>Last attempt failed: {data.failed.error}</Alert>}

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 700, minWidth: 0 }}>{data.lead.company || data.lead.name || data.lead.email}</div>
              <StatusBadge status={data.lead.status} />
            </div>
            <Info label="Name" value={data.lead.name} />
            <Info label="Email" value={data.lead.email} href={`mailto:${data.lead.email}`} />
            <Info label="Phone" value={data.lead.phone} href={data.lead.phone ? `tel:${data.lead.phone.split('/')[0].replace(/\s+/g, '')}` : null} />
            <Info label="Website" value={data.lead.website} href={data.lead.website || null} />
            <Info label="City" value={data.lead.city} />
            {Object.entries(data.lead.custom || {}).map(([k, v]) => (
              <Info key={k} label={k.replace(/_/g, ' ')} value={v} />
            ))}
            <Info label="Progress" value={`${data.lead.step} of ${data.totalSteps} emails sent`} />
            <Info label="Notes" value={data.lead.notes} />
          </div>

          <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: C.bg, padding: '12px 16px', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.mail.from && (
                <div>
                  <span style={{ color: C.muted }}>From: </span>
                  {data.mail.from}
                </div>
              )}
              <div>
                <span style={{ color: C.muted }}>To: </span>
                {data.lead.email}
              </div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>
                <span style={{ color: C.muted, fontWeight: 400 }}>Subject: </span>
                {data.mail.subject}
              </div>
            </div>
            <div style={{ padding: 16, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word' }}>{data.mail.text || '(message text not stored for this email)'}</div>
          </div>
          {data.state !== 'sent' && (
            <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Preview with the current Sequence page and Settings — if you edit them before it is sent, the email changes too.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
