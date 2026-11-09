'use client';
import { useState } from 'react';
import { Modal, Button, Field, inputStyle, Alert } from '../ui';
import { api } from '@/lib/api';
import { useWidth } from '@/lib/useWidth';

const EMPTY = { name: '', email: '', company: '', phone: '', website: '', city: '', notes: '', firstSubject: '', firstMessage: '' };

export default function AddLeadModal({ open, onClose, onDone }) {
  const width = useWidth();
  const [f, setF] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function close() {
    setF(EMPTY);
    setError('');
    onClose();
  }

  async function save() {
    setLoading(true);
    setError('');
    try {
      await api('/api/leads', { method: 'POST', body: f });
      onDone();
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const grid = { display: 'grid', gridTemplateColumns: width < 600 ? '1fr' : '1fr 1fr', gap: 14 };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Add a lead"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!f.email || loading}>
            {loading ? 'Saving…' : 'Add lead'}
          </Button>
        </>
      }
    >
      <div style={grid}>
        <Field label="Email *" htmlFor="l-email">
          <input id="l-email" type="email" value={f.email} onChange={set('email')} style={inputStyle} />
        </Field>
        <Field label="Contact name" htmlFor="l-name">
          <input id="l-name" value={f.name} onChange={set('name')} style={inputStyle} />
        </Field>
        <Field label="Company / business" htmlFor="l-company">
          <input id="l-company" value={f.company} onChange={set('company')} style={inputStyle} />
        </Field>
        <Field label="Phone" htmlFor="l-phone">
          <input id="l-phone" value={f.phone} onChange={set('phone')} style={inputStyle} />
        </Field>
        <Field label="Website" htmlFor="l-website">
          <input id="l-website" value={f.website} onChange={set('website')} style={inputStyle} />
        </Field>
        <Field label="City" htmlFor="l-city">
          <input id="l-city" value={f.city} onChange={set('city')} style={inputStyle} />
        </Field>
      </div>
      <Field label="First email — subject" htmlFor="l-fsub" style={{ marginTop: 14 }}>
        <input id="l-fsub" value={f.firstSubject} onChange={set('firstSubject')} style={inputStyle} />
      </Field>
      <Field label="First email — message" htmlFor="l-fmsg" hint="Leave empty to use the default Email 1 from the Sequence page. Signature and unsubscribe link are added automatically." style={{ marginTop: 14 }}>
        <textarea id="l-fmsg" value={f.firstMessage} onChange={set('firstMessage')} rows={6} style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'vertical', lineHeight: 1.55 }} />
      </Field>
      <Field label="Notes" htmlFor="l-notes" style={{ marginTop: 14 }}>
        <textarea id="l-notes" value={f.notes} onChange={set('notes')} rows={3} style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'vertical' }} />
      </Field>
      {error && <Alert style={{ marginTop: 14 }}>{error}</Alert>}
    </Modal>
  );
}
