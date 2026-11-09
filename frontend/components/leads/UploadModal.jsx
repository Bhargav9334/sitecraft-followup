'use client';
import { useRef, useState } from 'react';
import { C } from '../theme';
import { Modal, Button, Alert } from '../ui';
import { api } from '@/lib/api';
import { IconUpload } from '../icons';

const SAMPLE =
  'name,email,company,phone,website,city,subject,message\n' +
  'Ravi Sharma,ravi@sharmadental.in,Sharma Dental Care,9810000000,,Delhi,Website for Sharma Dental Care,"Hi {{first_name}},\n\nI noticed Sharma Dental Care does not have a website yet. Patients search online before booking, so a simple site with online booking could bring you more appointments.\n\nWould you like a quick quote?"\n' +
  'Amit Verma,amit@urbanfit.in,UrbanFit Gym,9810000001,urbanfit.in,Noida,Member app for UrbanFit,"Hi Amit,\n\nYour website takes a while to load on mobile. We can make it faster and add online membership sign-ups.\n\nOpen to a short call this week?"\n';

/** Counts data rows (not lines) — a quoted message can span several lines. */
function countCsvRows(text) {
  let rows = 0;
  let inQuotes = false;
  let hasContent = false;
  const s = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (inQuotes && s[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
      hasContent = true;
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && s[i + 1] === '\n') i++;
      if (hasContent) rows++;
      hasContent = false;
    } else if (c.trim() && c !== ',' && c !== ';' && c !== '\t') hasContent = true;
  }
  if (hasContent) rows++;
  return Math.max(0, rows - 1); // minus the header row
}

export default function UploadModal({ open, onClose, onDone }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [rows, setRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function reset() {
    setFile(null);
    setText('');
    setRows(0);
    setError('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  function pick(f) {
    setError('');
    setResult(null);
    if (!f) return;
    if (!/\.(csv|txt)$/i.test(f.name)) return setError('Only .csv files are supported (in Excel use "Save as CSV")');
    if (f.size > 5 * 1024 * 1024) return setError('File is larger than 5 MB');
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result || '');
      setFile(f);
      setText(t);
      setRows(countCsvRows(t));
    };
    reader.readAsText(f);
  }

  async function upload() {
    setLoading(true);
    setError('');
    try {
      const r = await api('/api/leads/import', { method: 'POST', body: { csv: text } });
      setResult(r);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const sampleHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Upload leads"
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={!text || loading}>
              {loading ? 'Uploading…' : rows ? `Add ${rows} leads` : 'Upload'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert kind="success">{result.added} new leads added to the queue. The system will start sending email 1 automatically.</Alert>
          {result.added > 0 && (
            <Alert kind="info">
              {result.withOwnFirstEmail} of {result.added} leads have their own first email from the CSV.
              {result.added - result.withOwnFirstEmail > 0 ? ` The other ${result.added - result.withOwnFirstEmail} will get the default Email 1 from the Sequence page.` : ''}
            </Alert>
          )}
          {result.duplicates > 0 && <Alert kind="info">{result.duplicates} were already in your list (or unsubscribed) — skipped.</Alert>}
          {result.invalid > 0 && (
            <Alert kind="warn">
              {result.invalid} rows had an invalid email — skipped.
              {result.invalidSamples?.length ? <div style={{ marginTop: 6, fontWeight: 400 }}>{result.invalidSamples.join(' · ')}</div> : null}
            </Alert>
          )}
        </div>
      ) : (
        <>
          <label
            htmlFor="csv-file"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files[0]);
            }}
            style={{ display: 'block', border: `1.5px dashed #AEBBFF`, background: '#FAFBFF', borderRadius: 12, padding: '32px 16px', textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ color: C.accent, display: 'flex', justifyContent: 'center' }}>
              <IconUpload size={30} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, marginTop: 8 }}>{file ? file.name : 'Drop a CSV file here or click to choose one'}</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 6 }}>{file ? `${rows} rows found` : 'Required: email · First email: subject, message · Optional: name, company, phone, website, city'}</div>
            <input ref={inputRef} id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files[0])} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
          </label>
          <div style={{ marginTop: 16, background: C.accentSoft, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.ink, lineHeight: 1.55 }}>
            <b>Each lead's first email comes from the CSV.</b> Add a <code>subject</code> and a <code>message</code> column — every row can have a different email. Follow-ups (emails 2–6) come from the Sequence page. Rows without a message get the default Email 1.
          </div>
          <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.55, margin: '12px 0 0' }}>
            Any extra column (e.g. <code>website_issue</code>) can be used in emails as <code>{'{{website_issue}}'}</code>. Uploading the same email again never creates a duplicate.{' '}
            <a href={sampleHref} download="sample-leads.csv" style={{ color: C.accent, fontWeight: 600 }}>
              Download sample CSV
            </a>
          </p>
          {error && <Alert style={{ marginTop: 14 }}>{error}</Alert>}
        </>
      )}
    </Modal>
  );
}
