'use client';
import { useEffect, useState, useCallback } from 'react';
import AppShell, { SYSTEM_EVENT } from '@/components/AppShell';
import HolidaysEditor from '@/components/settings/HolidaysEditor';
import { Card, Button, Field, inputStyle, Toggle, Alert, Loading, Badge } from '@/components/ui';
import { C } from '@/components/theme';
import { api } from '@/lib/api';
import { timeAgo, hourLabel } from '@/lib/format';
import { useWidth } from '@/lib/useWidth';

const HOURS = Array.from({ length: 25 }, (_, i) => i);

export default function SettingsPage() {
  const width = useWidth();
  const [s, setS] = useState(null);
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const load = useCallback(() => {
    api('/api/settings')
      .then((d) => {
        setS(d);
        setForm({ dailyLimit: d.dailyLimit, startHour: d.startHour, endHour: d.endHour, gapMinutes: d.gapMinutes, skipSundays: d.skipSundays, holidays: d.holidays, fromName: d.fromName, senderName: d.senderName, signature: { ...d.signature } });
      })
      .catch((e) => setMsg({ kind: 'error', text: e.message }));
  }, []);

  const loadStatus = useCallback(() => {
    api('/api/system/status')
      .then(setStatus)
      .catch((e) => setStatus({ error: e.message }));
  }, []);

  useEffect(() => {
    load();
    loadStatus();
    window.addEventListener(SYSTEM_EVENT, load);
    return () => window.removeEventListener(SYSTEM_EVENT, load);
  }, [load, loadStatus]);

  const set = (k, v) => setForm({ ...form, [k]: v });
  const setSig = (k, v) => setForm({ ...form, signature: { ...form.signature, [k]: v } });

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body = { ...form, dailyLimit: Number(form.dailyLimit), startHour: Number(form.startHour), endHour: Number(form.endHour), gapMinutes: Number(form.gapMinutes) };
      const d = await api('/api/settings', { method: 'PUT', body });
      setS(d);
      setMsg({ kind: 'success', text: 'Settings saved.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function setPaused(paused) {
    try {
      const d = await api(paused ? '/api/system/pause' : '/api/system/resume', { method: 'POST' });
      setS(d);
      window.dispatchEvent(new Event(SYSTEM_EVENT));
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }

  async function checkNow() {
    setChecking(true);
    try {
      await api('/api/system/check-replies', { method: 'POST' });
    } catch {}
    loadStatus();
    setChecking(false);
  }

  if (!s || !form)
    return (
      <AppShell title="Settings">
        {msg ? <Alert>{msg.text}</Alert> : <Loading />}
      </AppShell>
    );

  const slots = Math.min(Number(form.dailyLimit) || 0, Math.floor(((Number(form.endHour) - Number(form.startHour)) * 60 - 1) / Math.max(1, Number(form.gapMinutes))) + 1);
  const twoCol = width >= 1100;
  const grid2 = { display: 'grid', gridTemplateColumns: width < 640 ? '1fr' : '1fr 1fr', gap: 16 };

  return (
    <AppShell title="Settings" subtitle="Sending rules, holidays and email connection">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Automatic sending</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: C.sub }}>When turned off, no automatic emails are sent. When turned back on, it continues where it left off.</p>
            </div>
            <Badge fg={s.paused ? C.red : C.green} bg={s.paused ? C.redSoft : C.greenSoft}>
              {s.paused ? 'Stopped' : 'Running'}
            </Badge>
            <Toggle id="sys" label="Automatic sending on/off" checked={!s.paused} onChange={(on) => setPaused(!on)} />
          </div>
        </Card>

        <Card title="Sender name & signature" subtitle="Used in every email — change it anytime">
          <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 24, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={grid2}>
                <Field label="From name (shown in the inbox)" htmlFor="fn">
                  <input id="fn" value={form.fromName} onChange={(e) => set('fromName', e.target.value)} maxLength={80} style={inputStyle} />
                </Field>
                <Field label="Your name ({{sender_name}})" htmlFor="sn">
                  <input id="sn" value={form.senderName} onChange={(e) => set('senderName', e.target.value)} maxLength={60} style={inputStyle} />
                </Field>
              </div>
              <Field label="Signature — line 1" htmlFor="sc">
                <input id="sc" value={form.signature.closing} onChange={(e) => setSig('closing', e.target.value)} maxLength={80} placeholder="Best regards," style={inputStyle} />
              </Field>
              <Field label="Signature — line 2" htmlFor="sname">
                <input id="sname" value={form.signature.name} onChange={(e) => setSig('name', e.target.value)} maxLength={100} placeholder="SiteCraft by Bhargav" style={inputStyle} />
              </Field>
              <Field label="Phone / WhatsApp number" htmlFor="sp" hint="Leave empty to hide the number">
                <input id="sp" type="tel" value={form.signature.phone} onChange={(e) => setSig('phone', e.target.value)} maxLength={80} placeholder="+91 98765 43210" style={inputStyle} />
              </Field>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Email preview</div>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: C.bg, padding: '10px 14px', fontSize: 13, lineHeight: 1.6 }}>
                  <b>From:</b> {form.fromName || '—'} &lt;{s.fromEmail}&gt;
                </div>
                <div style={{ padding: 14, fontSize: 14, lineHeight: 1.6, color: C.sub }}>
                  <div>Hi Rahul,</div>
                  <div style={{ margin: '8px 0' }}>…your message…</div>
                  <div style={{ color: C.ink, whiteSpace: 'pre-line' }}>{[form.signature.closing, form.signature.name, form.signature.phone].map((x) => (x || '').trim()).filter(Boolean).join('\n')}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>If you don't want to receive more emails from me, unsubscribe here.</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          <Card title="Sending rules" subtitle="Runs automatically every day">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={grid2}>
                <Field label="Daily limit" htmlFor="dl" hint={`Maximum ${s.maxDailyLimit} (fixed in .env)`}>
                  <input id="dl" type="number" min={1} max={s.maxDailyLimit} value={form.dailyLimit} onChange={(e) => set('dailyLimit', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Gap between emails (minutes)" htmlFor="gap">
                  <input id="gap" type="number" min={1} value={form.gapMinutes} onChange={(e) => set('gapMinutes', e.target.value)} style={inputStyle} />
                </Field>
                <Field label="Start time" htmlFor="sh">
                  <select id="sh" value={form.startHour} onChange={(e) => set('startHour', e.target.value)} style={inputStyle}>
                    {HOURS.slice(0, 24).map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Stop time" htmlFor="eh">
                  <select id="eh" value={form.endHour} onChange={(e) => set('endHour', e.target.value)} style={inputStyle}>
                    {HOURS.slice(1).map((h) => (
                      <option key={h} value={h}>
                        {h === 24 ? '12 AM (midnight)' : hourLabel(h)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Toggle id="sun" label="No emails on Sundays" checked={form.skipSundays} onChange={(v) => set('skipSundays', v)} />
                <label htmlFor="sun" style={{ fontSize: 14 }}>
                  No emails on Sundays
                </label>
              </div>
              <Alert kind="info">
                With these settings, up to <b>{Math.max(0, slots)}</b> emails go out per day ({s.timezone}). Follow-ups get priority; remaining slots go to new leads.
              </Alert>
            </div>
          </Card>

          <Card title="Public holidays" subtitle="No emails are sent on these dates (Central Govt. list pre-loaded)">
            <HolidaysEditor holidays={form.holidays} onChange={(h) => set('holidays', h)} />
          </Card>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        </div>

        <Card title="Gmail connection" subtitle="The Gmail address and App Password come from the backend .env file">
          {!status ? (
            <Loading text="Checking connection…" />
          ) : status.error ? (
            <Alert>{status.error}</Alert>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: width < 800 ? '1fr' : '1fr 1fr', gap: 16 }}>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>SMTP — sending</b>
                  <Badge fg={status.smtp.ok ? C.green : C.red} bg={status.smtp.ok ? C.greenSoft : C.redSoft}>
                    {status.smtp.ok ? 'Connected' : 'Error'}
                  </Badge>
                </div>
                <p style={{ fontSize: 13, color: C.sub, margin: '10px 0 0', lineHeight: 1.5 }}>
                  {status.smtpHost} · From: {status.fromName ? `${status.fromName} <${status.fromEmail}>` : status.fromEmail}
                  <br />
                  {status.smtp.message}
                </p>
                {status.dryRun && (
                  <Alert kind="warn" style={{ marginTop: 10 }}>
                    MAIL_DRY_RUN=true — emails are not actually being sent.
                  </Alert>
                )}
              </div>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b style={{ fontSize: 14 }}>IMAP — reading replies</b>
                  <Badge fg={status.imap.configured && status.imap.last?.ok !== false ? C.green : C.red} bg={status.imap.configured && status.imap.last?.ok !== false ? C.greenSoft : C.redSoft}>
                    {!status.imap.configured ? 'Not set' : status.imap.last?.ok === false ? 'Error' : 'On'}
                  </Badge>
                </div>
                <p style={{ fontSize: 13, color: C.sub, margin: '10px 0 0', lineHeight: 1.5 }}>
                  {status.imapHost} · inbox checked every {status.imap.pollMinutes} min.
                  <br />
                  {status.imap.last ? `${timeAgo(status.imap.last.at)}: ${status.imap.last.message}` : 'Not checked yet'}
                </p>
                <Button variant="secondary" size="sm" style={{ marginTop: 10 }} onClick={checkNow} disabled={checking || !status.imap.configured}>
                  {checking ? 'Checking…' : 'Check now'}
                </Button>
              </div>
              <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 13, color: C.sub }}>
                {status.unsubscribeMode === 'link' ? (
                  <>Unsubscribe: one-click link <code>{status.publicBackendUrl}/u/…</code> (leads can also reply &quot;unsubscribe&quot;).</>
                ) : (
                  <>Unsubscribe: leads reply &quot;unsubscribe&quot; and are moved to the Unsubscribed list automatically. No domain needed.</>
                )}
              </p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
