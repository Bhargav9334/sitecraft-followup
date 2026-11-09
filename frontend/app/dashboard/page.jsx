'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell, { SYSTEM_EVENT } from '@/components/AppShell';
import DashboardView from '@/components/dashboard/DashboardView';
import { Alert, Loading, buttonStyle } from '@/components/ui';
import { api } from '@/lib/api';
import { IconUpload } from '@/components/icons';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState('');

  const load = useCallback(() => {
    api('/api/dashboard')
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    window.addEventListener(SYSTEM_EVENT, load);
    return () => {
      clearInterval(t);
      window.removeEventListener(SYSTEM_EVENT, load);
    };
  }, [load]);

  async function checkReplies() {
    setChecking(true);
    setCheckMsg('');
    try {
      const r = await api('/api/system/check-replies', { method: 'POST' });
      setCheckMsg(r.message || 'Done');
      load();
    } catch (e) {
      setCheckMsg(e.message);
    } finally {
      setChecking(false);
    }
  }

  const s = data?.settings;
  return (
    <AppShell
      title="Dashboard"
      subtitle={s ? `${s.dailyLimit} emails/day · ${hour(s.startHour)} – ${hour(s.endHour)} · 1 email every ${s.gapMinutes} min` : 'Loading…'}
      actions={
        <Link href="/leads?upload=1" style={buttonStyle('primary', 'sm')}>
          <IconUpload size={15} />
          Upload leads
        </Link>
      }
    >
      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && <DashboardView data={data} onCheckReplies={checkReplies} checking={checking} checkMsg={checkMsg} />}
    </AppShell>
  );
}

function hour(h) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}
