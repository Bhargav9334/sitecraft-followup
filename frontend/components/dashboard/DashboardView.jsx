'use client';
import { useState } from 'react';
import Link from 'next/link';
import EmailDetailModal from '../EmailDetailModal';
import { C, STATUS } from '../theme';
import { Card, Badge, Avatar, Alert, Button, Empty } from '../ui';
import { fmtTime, fmtDateTime, timeAgo, hourLabel, relDay } from '@/lib/format';
import { useWidth } from '@/lib/useWidth';

function Stat({ label, value, note, color = C.ink, href }) {
  const inner = (
    <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: '16px 18px', height: '100%', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 13, color: C.sub, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6 }}>{value}</div>
      {note && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{note}</div>}
    </div>
  );
  return href ? (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** The day's sending slots: start hour + gap, up to the daily limit. */
function buildSlots(settings) {
  const slots = [];
  let minutes = settings.startHour * 60;
  while (slots.length < (settings.effectiveDailyLimit ?? settings.dailyLimit) && minutes < settings.endHour * 60) {
    slots.push(minutes);
    minutes += settings.gapMinutes;
  }
  return slots;
}

function slotLabel(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${hourLabel(h).replace(' ', `:${String(min).padStart(2, '0')} `)}` : hourLabel(h);
}

export default function DashboardView({ data, onCheckReplies, checking, checkMsg }) {
  const width = useWidth();
  const cols = width < 700 ? 2 : width < 1200 ? 3 : 6;
  const twoCol = width >= 1100;
  const { counts, settings } = data;
  const slots = buildSlots(settings);
  const blocked = settings.paused ? 'System stopped' : data.dayBlocked;
  const [open, setOpen] = useState(null); // { leadId, step }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {data.dryRun && <Alert kind="warn">MAIL_DRY_RUN is on — emails are not actually sent, only printed in the backend console.</Alert>}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 14 }}>
        <Stat label="Total leads" value={counts.total || 0} note="Uploaded" href="/leads" />
        <Stat label="Queue" value={counts.queued || 0} note="Waiting for email 1" href="/leads?status=queued" />
        <Stat label="In sequence" value={counts.active || 0} note="Follow-ups running" color={C.accent} href="/leads?status=active" />
        <Stat label="Replied" value={counts.replied || 0} note="Follow-ups stopped" color={C.green} href="/replies" />
        <Stat label="Unsubscribed" value={counts.unsubscribed || 0} note="Never emailed again" color={C.red} href="/unsubscribed" />
        <Stat label="Sent today" value={`${data.sentToday}/${settings.effectiveDailyLimit ?? settings.dailyLimit}`} note={`${data.totalSent} emails sent in total`} />
      </div>

      <Card
        title="Today's sending schedule"
        subtitle={`1 email every ${settings.gapMinutes} min · follow-ups first, then new leads`}
        right={
          <Badge fg={data.sendStatus.ok ? C.green : blocked ? C.red : C.sub} bg={data.sendStatus.ok ? C.greenSoft : blocked ? C.redSoft : '#EEF0F3'}>
            {data.sendStatus.ok ? '● Ready to send' : data.sendStatus.reason}
          </Badge>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(slots.length, width < 700 ? 5 : 10)}, minmax(0, 1fr))`, gap: 8 }}>
          {slots.map((m, i) => {
            const sent = data.todaySent[i];
            const isNext = !sent && i === data.todaySent.length && !blocked;
            return (
              <div
                key={m}
                role={sent ? 'button' : undefined}
                tabIndex={sent ? 0 : undefined}
                title={sent ? 'Click to see the full email' : undefined}
                onClick={sent ? () => setOpen({ leadId: sent.leadId, step: sent.step }) : undefined}
                onKeyDown={sent ? (e) => (e.key === 'Enter' || e.key === ' ') && setOpen({ leadId: sent.leadId, step: sent.step }) : undefined}
                style={{
                  cursor: sent ? 'pointer' : 'default',
                  borderRadius: 8,
                  padding: '10px 8px',
                  minHeight: 78,
                  boxSizing: 'border-box',
                  border: `1px solid ${isNext ? C.green : C.line}`,
                  background: sent ? C.white : isNext ? C.greenSoft : C.bg,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: sent || isNext ? C.ink : C.muted }}>{slotLabel(m)}</div>
                {sent ? (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sent.company || sent.name || sent.email}>
                      {sent.company || sent.name || sent.email}
                    </div>
                    <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>
                      Email {sent.step} · {fmtTime(sent.at)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: isNext ? C.green : C.muted, marginTop: 6 }}>{isNext ? 'Next' : blocked ? 'Off' : 'Free'}</div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: C.sub }}>
          {data.nextSlot ? `Next sending slot: ${fmtDateTime(data.nextSlot)} (if a lead is due)` : 'System stopped — nothing scheduled'}
          {data.todaySent.length > 0 && ' · Click a sent slot to read the full email.'}
        </p>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr)', gap: 20 }}>
        <Card title="Upcoming emails" subtitle="Which lead gets which email next" right={<Link href="/leads" style={{ fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: 'none' }}>All leads →</Link>}>
          {data.upcoming.length === 0 ? (
            <Empty title="No emails pending" text="Upload new leads and the system will start sending automatically." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {data.upcoming.map((u, i) => (
                <button
                  type="button"
                  key={u.id}
                  title="Click to see the full email"
                  onClick={() => setOpen({ leadId: u.id, step: u.nextStep })}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', border: 'none', borderTop: i ? `1px solid ${C.line}` : 'none', background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                >
                  <Avatar name={u.name || u.company} email={u.email} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.company || u.name || u.email}</div>
                    <div style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: width < 700 ? 'column' : 'row', alignItems: width < 700 ? 'flex-end' : 'center', gap: width < 700 ? 4 : 12, flexShrink: 0 }}>
                    <Badge fg={u.nextStep === 1 ? C.sub : C.accent} bg={u.nextStep === 1 ? '#EEF0F3' : C.accentSoft}>
                      Email {u.nextStep}
                    </Badge>
                    <span style={{ fontSize: 12, color: C.sub, minWidth: width < 700 ? 0 : 120, textAlign: 'right' }}>{relDay(u.nextSendAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {data.upcoming.length > 0 && <p style={{ margin: '10px 0 0', fontSize: 12, color: C.muted }}>Click any email to see who it goes to and the full message.</p>}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Lead pipeline">
            {['queued', 'active', 'replied', 'completed', 'stopped', 'unsubscribed', 'bounced'].map((k) => {
              const v = counts[k] || 0;
              const pct = counts.total ? Math.round((v / counts.total) * 100) : 0;
              return (
                <Link key={k} href={`/leads?status=${k}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 500 }}>{STATUS[k].label}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.bg }}>
                    <div style={{ width: `${pct}%`, height: 6, borderRadius: 3, background: STATUS[k].fg }} />
                  </div>
                </Link>
              );
            })}
          </Card>

          <Card title="Reply check (IMAP)" subtitle={data.imap.configured ? 'The inbox is checked every few minutes' : 'IMAP is not configured in .env'}>
            <p style={{ margin: 0, fontSize: 13, color: data.imap.last && !data.imap.last.ok ? C.red : C.sub, lineHeight: 1.5 }}>
              {data.imap.last ? `${timeAgo(data.imap.last.at)}: ${data.imap.last.message}` : 'Not checked yet'}
            </p>
            <Button variant="secondary" size="sm" onClick={onCheckReplies} disabled={checking || !data.imap.configured} style={{ marginTop: 12 }}>
              {checking ? 'Checking…' : 'Check replies now'}
            </Button>
            {checkMsg && <p style={{ margin: '10px 0 0', fontSize: 13, color: C.sub }}>{checkMsg}</p>}
          </Card>
        </div>
      </div>

      <Card title="Latest replies" subtitle="Follow-ups stop as soon as a lead replies — continue the conversation in Gmail" right={<Link href="/replies" style={{ fontSize: 13, fontWeight: 600, color: C.accent, textDecoration: 'none' }}>All replies →</Link>}>
        {data.recentReplies.length === 0 ? (
          <Empty title="No replies yet" text="Replies will show up here as soon as they arrive." />
        ) : (
          data.recentReplies.map((r, i) => (
            <Link key={i} href={`/leads/${r.leadId}`} style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: i ? `1px solid ${C.line}` : 'none', textDecoration: 'none', color: 'inherit' }}>
              <Avatar name={r.name || r.company} email={r.email} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {r.name || r.email}
                  {r.company ? <span style={{ color: C.sub, fontWeight: 400 }}> · {r.company}</span> : null}
                </div>
                <div style={{ fontSize: 13, color: C.sub, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{timeAgo(r.at)}</div>
                {r.afterStep ? <div style={{ fontSize: 12, color: C.muted }}>After email {r.afterStep}</div> : null}
              </div>
            </Link>
          ))
        )}
      </Card>
      <EmailDetailModal open={Boolean(open)} onClose={() => setOpen(null)} leadId={open?.leadId} step={open?.step} />
    </div>
  );
}
