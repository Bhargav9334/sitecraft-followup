'use client';
import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import SequenceEditor from '@/components/sequence/SequenceEditor';
import { Alert, Loading } from '@/components/ui';
import { api } from '@/lib/api';

export default function SequencePage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/sequence')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const days = data ? data.steps.slice(1).map((s) => s.delayDays).join(' → ') : '';
  return (
    <AppShell title="Email sequence" subtitle={data ? `6 emails · delays (days): ${days} · stops when the lead replies` : ''}>
      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && <SequenceEditor initial={data} />}
    </AppShell>
  );
}
