'use client';
import { useRef, useState } from 'react';
import { C } from '../theme';
import { Card, Button, Field, inputStyle, Badge, Alert } from '../ui';
import { api } from '@/lib/api';
import { useWidth } from '@/lib/useWidth';
import { IconClock } from '../icons';

const VARS = ['{{first_name|there}}', '{{name}}', '{{company|your business}}', '{{city}}', '{{website}}', '{{sender_name}}'];

/** "{{company|your business}}" -> "{company}" for the short list view */
function short(t) {
  return String(t || '').replace(/\{\{\s*([a-zA-Z0-9_]+)[^}]*\}\}/g, '{$1}');
}

function dayTotal(steps, i) {
  return steps.slice(1, i + 1).reduce((a, s) => a + (Number(s.delayDays) || 0), 0);
}

export default function SequenceEditor({ initial, onSaved }) {
  const width = useWidth();
  const [steps, setSteps] = useState(initial.steps);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [preview, setPreview] = useState(null);
  const [testTo, setTestTo] = useState('');
  const bodyRef = useRef(null);
  const step = steps[active];
  const sig = initial.signature || {};

  function update(patch) {
    setSteps(steps.map((s, i) => (i === active ? { ...s, ...patch } : s)));
    setDirty(true);
    setPreview(null);
  }

  function insertVar(v) {
    const el = bodyRef.current;
    if (!el) return update({ body: step.body + v });
    const start = el.selectionStart ?? step.body.length;
    const end = el.selectionEnd ?? step.body.length;
    update({ body: step.body.slice(0, start) + v + step.body.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + v.length;
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const body = { steps: steps.map((s, i) => ({ ...s, delayDays: i === 0 ? 0 : Number(s.delayDays) })) };
      const r = await api('/api/sequence', { method: 'PUT', body });
      setSteps(r.steps);
      setDirty(false);
      setMsg({ kind: 'success', text: 'Sequence saved. Upcoming emails will use this text.' });
      onSaved && onSaved();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function restoreDefaults() {
    if (!window.confirm('Replace all 6 emails with the default SiteCraft emails? Your current text will be overwritten.')) return;
    setSaving(true);
    setMsg(null);
    try {
      const r = await api('/api/sequence/reset', { method: 'POST' });
      setSteps(r.steps);
      setDirty(false);
      setPreview(null);
      setMsg({ kind: 'success', text: 'Default emails restored.' });
      onSaved && onSaved();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function showPreview() {
    try {
      const r = await api('/api/sequence/preview', { method: 'POST', body: { index: active, step } });
      setPreview(r);
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }

  async function sendTest() {
    setMsg(null);
    if (dirty) return setMsg({ kind: 'error', text: 'Click "Save sequence" first, then send a test.' });
    try {
      const r = await api('/api/system/test-email', { method: 'POST', body: { index: active, to: testTo || undefined } });
      setMsg({ kind: 'success', text: `Test email (email ${active + 1}) sent to ${r.to}.` });
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }

  const twoCol = width >= 1100;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: twoCol ? 'minmax(280px, 380px) minmax(0, 1fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px 14px' }}>
                <Badge fg={i === 0 ? C.accent : C.sub} bg={i === 0 ? C.accentSoft : C.white} style={{ border: i === 0 ? 'none' : `1px solid ${C.line}` }}>
                  <IconClock size={13} />
                  {i === 0 ? 'First email' : `${s.delayDays} days later`}
                </Badge>
                {i > 0 && <span style={{ fontSize: 12, color: C.muted }}>Day {dayTotal(steps, i)}</span>}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActive(i);
                  setPreview(null);
                }}
                aria-pressed={on}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 12, padding: 14, borderRadius: 12, background: C.white, border: on ? `2px solid ${C.accent}` : `1px solid ${C.line}`, cursor: 'pointer', fontFamily: 'inherit', boxShadow: on ? '0 4px 14px rgba(61,90,254,.12)' : 'none' }}
              >
                <span style={{ width: 28, height: 28, borderRadius: 8, background: on ? C.accent : C.ink, color: '#fff', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '.04em' }}>EMAIL {i + 1}</span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{short(s.subject || `Re: ${steps[0].subject}`)}</span>
                  <span style={{ display: 'block', fontSize: 13, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{short(s.body.split('\n').find((l) => l.trim() && !/^hi\b/i.test(l.trim())) || s.body)}</span>
                </span>
              </button>
            </div>
          );
        })}
        <div style={{ marginTop: 12, background: C.greenSoft, color: C.green, fontSize: 13, fontWeight: 600, padding: '12px 14px', borderRadius: 10 }}>
          When a lead replies, their remaining emails are cancelled. No reply after all 6 → “No reply”.
        </div>
      </div>

      <Card
        title={`Email ${active + 1}${active === 0 ? ' · Default first email' : ' · Follow-up'}`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={restoreDefaults} disabled={saving}>
              Restore default emails
            </Button>
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? 'Saving…' : dirty ? 'Save sequence' : 'Saved ✓'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {active === 0 && (
            <Alert kind="info">
              Each lead's first email comes from the <b>subject</b> and <b>message</b> columns of your CSV. This text is only used for leads that have no message of their own.
            </Alert>
          )}
          {active > 0 && (
            <Field label={`Days after email ${active}`} htmlFor="delay" hint="1 to 90 days. If it falls on a Sunday or holiday, it goes out on the next working day.">
              <input id="delay" type="number" min={1} max={90} value={step.delayDays} onChange={(e) => update({ delayDays: e.target.value })} style={{ ...inputStyle, maxWidth: 140 }} />
            </Field>
          )}
          <Field label="Subject" htmlFor="subject" hint={active > 0 ? 'Leave empty to reply in the same thread as “Re: (email 1 subject)” — recommended.' : 'Email 1 needs a subject.'}>
            <input id="subject" value={step.subject} onChange={(e) => update({ subject: e.target.value })} placeholder={active > 0 ? `Re: ${steps[0].subject}` : ''} style={inputStyle} />
          </Field>
          <Field label="Message" htmlFor="body">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              {VARS.map((v) => (
                <button key={v} type="button" onClick={() => insertVar(v)} style={{ border: 0, background: C.accentSoft, color: C.accent, borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + {v}
                </button>
              ))}
            </div>
            <textarea ref={bodyRef} id="body" value={step.body} onChange={(e) => update({ body: e.target.value })} rows={16} style={{ ...inputStyle, height: 'auto', padding: 14, lineHeight: 1.6, resize: 'vertical' }} />
          </Field>
          <div style={{ background: C.bg, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.sub, lineHeight: 1.55 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4 }}>Added automatically to the end of every email (change it in Settings):</div>
            <div style={{ whiteSpace: 'pre-line', color: C.ink }}>{[sig.closing, sig.name, sig.phone].map((x) => (x || '').trim()).filter(Boolean).join('\n') || '(signature is empty)'}</div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            <code>{'{{company|your business}}'}</code> means: if company is empty, “your business” is used. Use any CSV column as <code>{'{{column_name}}'}</code> . Don't type the signature or unsubscribe link — both are added automatically.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant="secondary" onClick={showPreview}>
              Preview
            </Button>
            <input aria-label="Test email address" placeholder="Test email (empty = FROM_EMAIL)" value={testTo} onChange={(e) => setTestTo(e.target.value)} style={{ ...inputStyle, width: 260 }} />
            <Button variant="secondary" onClick={sendTest}>
              Send test email
            </Button>
          </div>
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          {preview && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: C.bg, padding: '10px 14px', fontSize: 13 }}>
                <div>
                  <b>From:</b> {preview.from}
                </div>
                <div style={{ marginTop: 4 }}>
                  <b>To:</b> {preview.to} (sample lead)
                </div>
                <div style={{ marginTop: 4 }}>
                  <b>Subject:</b> {preview.subject}
                </div>
              </div>
              <div style={{ padding: 14, fontSize: 14, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{preview.text}</div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
