'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Alert, Loading, Empty, Avatar, th, td } from '@/components/ui';
import { C } from '@/components/theme';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

export default function UnsubscribedPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/unsubscribed')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell title="Unsubscribed" subtitle="These people clicked the unsubscribe link — they will never be emailed again, even if uploaded again">
      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && (
        <Card pad={0}>
          {data.items.length === 0 ? (
            <Empty title="No one has unsubscribed" text="An unsubscribe link is added to the bottom of every email automatically." />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={th}>Lead</th>
                    <th style={th}>Email</th>
                    <th style={th}>Emails sent</th>
                    <th style={th}>Unsubscribed on</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((l) => (
                    <tr key={l.id}>
                      <td style={td}>
                        <Link href={`/leads/${l.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.ink, textDecoration: 'none', fontWeight: 600 }}>
                          <Avatar name={l.name || l.company} email={l.email} size={30} />
                          {l.company || l.name || '—'}
                        </Link>
                      </td>
                      <td style={td}>{l.email}</td>
                      <td style={td}>{l.step} / 6</td>
                      <td style={td}>{fmtDateTime(l.unsubscribedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}
