'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import LeadDetailView from '@/components/leads/LeadDetailView';
import { Alert, Loading } from '@/components/ui';
import { C } from '@/components/theme';
import { api } from '@/lib/api';

export default function LeadDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api(`/api/leads/${id}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(path, method = 'POST') {
    setBusy(true);
    try {
      await api(path, { method });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this lead and its entire email history?')) return;
    setBusy(true);
    try {
      await api(`/api/leads/${id}`, { method: 'DELETE' });
      router.replace('/leads');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <AppShell
      title={data ? data.lead.company || data.lead.name || data.lead.email : 'Lead'}
      subtitle={
        <Link href="/leads" style={{ color: C.sub, textDecoration: 'none' }}>
          ← All leads
        </Link>
      }
    >
      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && <LeadDetailView data={data} busy={busy} onStop={() => run(`/api/leads/${id}/stop`)} onResume={() => run(`/api/leads/${id}/resume`)} onDelete={remove} onChanged={load} />}
    </AppShell>
  );
}
