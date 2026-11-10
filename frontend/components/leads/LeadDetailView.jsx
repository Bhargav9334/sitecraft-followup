'use client';
import { useState } from 'react';
import { C } from '../theme';
import { Card, StatusBadge, Avatar, Button, LinkButton, Badge, Field, inputStyle, Alert } from '../ui';
import { api } from '@/lib/api';
import { fmtDateTime, relDay, gmailLink } from '@/lib/format';
import { useWidth } from '@/lib/useWidth';
import { IconExternal, IconStop, IconPlay } from '../icons';
import EmailDetailModal from '../EmailDetailModal';

function Row({ label, value, href }) {
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 3, wordBreak: 'break-word' }}>
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: C.accent }}>
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          '—'
        )}
      </div>
    </div>
  );
}

/** The lead's own first email (from the CSV). Editable until it has been sent. */
function FirstEmailCard({ lead, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(lead.firstSubject || '');
  const [message, setMessage] = useState(lead.firstMessage || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const sent = lead.step > 0;
  const own = Boolean(lead.firstMessage);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api(`/api/leads/${lead.id}`, { method: 'PATCH', body: { firstSubject: subject, firstMessage: message } });
      setEditing(false);
      onChanged && onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="First email"
      subtitle={own ? (sent ? 'From the CSV · already sent' : 'From the CSV · sent as email 1') : 'No message in the CSV · the default Email 1 from the Sequence page is used'}
      right={
        !sent && !editing ? (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            {own ? 'Edit' : 'Write a custom first email'}
          </Button>
        ) : null
      }
    >
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Subject" htmlFor="fe-subject" hint="Leave empty to use the default subject">
            <input id="fe-subject" value={subject} onChange={(e) => setSubject(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Message" htmlFor="fe-message" hint="Leave empty to use the default Email 1. Signature and unsubscribe link are added automatically.">
            <textarea id="fe-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={10} style={{ ...inputStyle, height: 'auto', padding: 12, lineHeight: 1.55, resize: 'vertical' }} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save first email'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setSubject(lead.firstSubject || '');
                setMessage(lead.firstMessage || '');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : own ? (
        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: C.bg, padding: '10px 14px', fontSize: 13 }}>
            <b>Subject:</b> {lead.firstSubject || '(default subject)'}
          </div>
          <div style={{ padding: 14, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{lead.firstMessage}</div>
        </div>
      ) : null}
    </Card>
  );
}

/** Sent date for each of the 6 steps, or the expected/cancelled state. */
function stepTimeline(lead, logs, totalSteps) {
  const sentByStep = {};
  for (const l of logs) if (l.direction === 'out' && l.status === 'sent') sentByStep[l.step] = l;
  return Array.from({ length: totalSteps }).map((_, i) => {
    const n = i + 1;
    if (sentByStep[n]) return { n, state: 'sent', at: sentByStep[n].at, subject: sentByStep[n].subject };
    if (n === lead.step + 1 && (lead.status === 'active' || lead.status === 'queued')) return { n, state: 'next', at: lead.nextSendAt };
    if (lead.status === 'active' || lead.status === 'queued') return { n, state: 'pending' };
    return { n, state: 'cancelled' };
  });
}

export default function LeadDetailView({ data, onStop, onResume, onDelete, onChanged, busy }) {
  const width = useWidth();
  const { lead, logs, totalSteps } = data;
  const timeline = stepTimeline(lead, logs, totalSteps);
  const canStop = lead.status === 'queued' || lead.status === 'active';
  const canResume = ['stopped', 'replied', 'completed'].includes(lead.status) && lead.step < totalSteps;
  const custom = Object.entries(lead.custom || {});
  const conversation = [...logs].sort((a, b) => new Date(b.at) - new Date(a.at));
  const [openStep, setOpenStep] = useState(null);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: width >= 1100 ? 'minmax(0, 2fr) minmax(300px, 1fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        <FirstEmailCard key={`${lead.id}-${lead.updatedAt}`} lead={lead} onChanged={onChanged} />
        <Card title="6-email sequence" subtitle={`${lead.step} of ${totalSteps} emails sent · click an email to read it in full`}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {timeline.map((t) => {
              const color = t.state === 'sent' ? C.accent : t.state === 'next' ? C.green : '#C5CBD5';
              const isReplyPoint = lead.status === 'replied' && lead.repliedAfterStep === t.n;
              return (
                <div
                  key={t.n}
                  role="button"
                  tabIndex={0}
                  title="Click to see the full email"
                  onClick={() => setOpenStep(t.n)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpenStep(t.n)}
                  style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 0', borderTop: t.n > 1 ? `1px solid ${C.line}` : 'none', cursor: 'pointer' }}
                >
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: color, color: '#fff', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t.n}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Email {t.n}</div>
                    {t.subject && <div style={{ fontSize: 13, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>}
                  </div>
                  <span style={{ fontSize: 13, color: t.state === 'sent' ? C.ink : C.muted, textAlign: 'right' }}>
                    {t.state === 'sent' && `Sent · ${fmtDateTime(t.at)}`}
                    {t.state === 'next' && `Next · ${relDay(t.at)}`}
                    {t.state === 'pending' && 'Pending'}
                    {t.state === 'cancelled' && 'Will not be sent'}
                  </span>
                  {isReplyPoint && <Badge fg={C.green} bg={C.greenSoft}>Replied</Badge>}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Email history" subtitle="Emails sent and replies received">
          {conversation.length === 0 ? (
            <p style={{ margin: 0, color: C.sub, fontSize: 14 }}>No emails sent yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {conversation.map((l) => {
                const incoming = l.direction === 'in';
                const label = incoming ? (l.kind === 'reply' ? 'Reply' : l.kind === 'auto' ? 'Auto-reply' : l.kind === 'unsubscribe' ? 'Unsubscribed (by reply)' : 'Bounce') : l.status === 'failed' ? `Email ${l.step} · failed` : `Email ${l.step}`;
                const fg = incoming ? (l.kind === 'reply' ? C.green : C.amber) : l.status === 'failed' ? C.red : C.accent;
                const bg = incoming ? (l.kind === 'reply' ? C.greenSoft : C.amberSoft) : l.status === 'failed' ? C.redSoft : C.accentSoft;
                return (
                  <div key={l.id} style={{ border: `1px solid ${incoming && l.kind === 'reply' ? C.green : C.line}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Badge fg={fg} bg={bg}>
                        {label}
                      </Badge>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>{incoming ? `${l.fromEmail || lead.email} → You` : `You → ${lead.email}`}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{fmtDateTime(l.at)}</span>
                    </div>
                    {l.subject && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{l.subject}</div>}
                    {l.error && <div style={{ fontSize: 13, color: C.red, marginTop: 8 }}>{l.error}</div>}
                    {l.text && <div style={{ fontSize: 13, color: C.sub, marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 220, overflow: 'auto' }}>{l.text}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar name={lead.name || lead.company} email={lead.email} size={52} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{lead.company || lead.name || lead.email}</div>
            {lead.company && lead.name && <div style={{ fontSize: 13, color: C.sub }}>{lead.name}</div>}
          </div>
        </div>
        <div style={{ margin: '16px 0' }}>
          <StatusBadge status={lead.status} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {lead.status === 'replied' && (
            <LinkButton variant="success" href={gmailLink(lead.email)} target="_blank" rel="noopener noreferrer">
              Continue in Gmail
              <IconExternal size={15} />
            </LinkButton>
          )}
          {canStop && (
            <Button variant="secondary" onClick={onStop} disabled={busy}>
              <IconStop size={14} />
              Stop emails to this lead
            </Button>
          )}
          {canResume && (
            <Button variant="secondary" onClick={onResume} disabled={busy}>
              <IconPlay size={14} />
              Resume from email {lead.step + 1}
            </Button>
          )}
          <Button variant="danger" onClick={onDelete} disabled={busy}>
            Delete lead
          </Button>
        </div>
        <Row label="Email" value={lead.email} href={`mailto:${lead.email}`} />
        <Row label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone.replace(/\s+/g, '')}` : null} />
        <Row label="Website" value={lead.website} href={lead.website} />
        <Row label="City" value={lead.city} />
        <Row label="Emails sent" value={`${lead.step} / ${totalSteps}`} />
        <Row label="Replies" value={String(lead.replyCount || 0)} />
        <Row label="Added" value={`${fmtDateTime(lead.createdAt)} · ${lead.source === 'csv' ? 'CSV' : 'Manual'}`} />
        {custom.map(([k, v]) => (
          <Row key={k} label={k.replace(/_/g, ' ')} value={v} />
        ))}
        {lead.notes && <Row label="Notes" value={lead.notes} />}
        {lead.lastError && <Row label="Last error" value={lead.lastError} />}
      </Card>
      <EmailDetailModal open={Boolean(openStep)} onClose={() => setOpenStep(null)} leadId={lead.id} step={openStep} />
    </div>
  );
}
