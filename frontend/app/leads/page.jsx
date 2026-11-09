'use client';
import { useCallback, useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import LeadsTable from '@/components/leads/LeadsTable';
import UploadModal from '@/components/leads/UploadModal';
import AddLeadModal from '@/components/leads/AddLeadModal';
import { Button, Card, Empty, Loading, Alert, inputStyle } from '@/components/ui';
import { C, STATUS } from '@/components/theme';
import { api } from '@/lib/api';
import { IconUpload, IconPlus } from '@/components/icons';

const TABS = ['', 'queued', 'active', 'replied', 'completed', 'stopped', 'unsubscribed', 'bounced'];
const LIMIT = 50;

export default function LeadsPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busyId, setBusyId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [booted, setBooted] = useState(false);

  // read ?status= / ?upload=1 from the URL once
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (TABS.includes(p.get('status') || '')) setStatus(p.get('status') || '');
    if (p.get('upload') === '1') setShowUpload(true);
    setBooted(true);
  }, []);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => {
    if (!booted) return;
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status) params.set('status', status);
    if (query) params.set('q', query);
    api(`/api/leads?${params}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [status, query, page, booted]);

  useEffect(() => {
    load();
  }, [load]);

  function changeTab(t) {
    setStatus(t);
    setPage(1);
    setSelected(new Set());
    const url = t ? `/leads?status=${t}` : '/leads';
    window.history.replaceState(null, '', url);
  }

  async function act(lead, action) {
    setBusyId(lead.id);
    try {
      await api(`/api/leads/${lead.id}/${action}`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function bulk(action) {
    if (action === 'delete' && !window.confirm(`Permanently delete ${selected.size} leads? Their email history will be deleted too.`)) return;
    try {
      const r = await api('/api/leads/bulk', { method: 'POST', body: { ids: [...selected], action } });
      setNotice(`${action[0].toUpperCase() + action.slice(1)}: ${r.done} leads updated${r.skipped ? ` · ${r.skipped} skipped` : ''}`);
      setSelected(new Set());
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  const toggle = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (!data) return;
    const all = data.items.every((l) => selected.has(l.id));
    setSelected(all ? new Set() : new Set(data.items.map((l) => l.id)));
  };

  const counts = data?.counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <AppShell
      title="Leads"
      subtitle={data ? `${total} leads · ${counts.active || 0} in sequence · ${counts.queued || 0} in queue` : ''}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={() => setShowAdd(true)}>
            <IconPlus size={15} />
            Add lead
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <IconUpload size={15} />
            Upload CSV
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }} role="tablist" aria-label="Status filter">
        {TABS.map((t) => {
          const on = status === t;
          const n = t ? counts[t] || 0 : total;
          return (
            <button
              key={t || 'all'}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => changeTab(t)}
              style={{ height: 36, padding: '0 14px', borderRadius: 8, border: `1px solid ${on ? C.ink : C.line}`, background: on ? C.ink : C.white, color: on ? '#fff' : C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {t ? STATUS[t].label : 'All'}
              <span style={{ fontWeight: 500, color: on ? C.sideText : C.muted }}>{n}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input type="search" aria-label="Search leads" placeholder="Search by name, company, email, city…" value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, maxWidth: 360 }} />
        {selected.size > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.size} selected</span>
            <Button variant="secondary" size="sm" onClick={() => bulk('stop')}>
              Stop
            </Button>
            <Button variant="secondary" size="sm" onClick={() => bulk('resume')}>
              Resume
            </Button>
            <Button variant="danger" size="sm" onClick={() => bulk('delete')}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {notice && (
        <Alert kind="success" style={{ marginBottom: 16 }}>
          {notice}
        </Alert>
      )}

      <Card pad={0}>
        {!data ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <Empty
            title={query || status ? 'No leads match this filter' : 'No leads yet'}
            text={query || status ? 'Try a different filter or search.' : 'Upload a CSV — the system will start sending automatically from 9 AM.'}
            action={!query && !status ? <Button onClick={() => setShowUpload(true)}><IconUpload size={15} /> Upload CSV</Button> : null}
          />
        ) : (
          <>
            <LeadsTable items={data.items} totalSteps={6} selected={selected} onToggle={toggle} onToggleAll={toggleAll} onStop={(l) => act(l, 'stop')} onResume={(l) => act(l, 'resume')} busyId={busyId} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', fontSize: 13, color: C.sub, flexWrap: 'wrap', gap: 10 }}>
              <span>
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} of {data.total}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Prev
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next →
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <p style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Bars: blue = email sent · green = replied after this email · grey = pending</p>

      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} onDone={load} />
      <AddLeadModal open={showAdd} onClose={() => setShowAdd(false)} onDone={load} />
    </AppShell>
  );
}
