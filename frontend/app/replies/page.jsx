'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { Card, Alert, Loading, Empty, Avatar, LinkButton, StatusBadge, Button, buttonStyle } from '@/components/ui';
import { C } from '@/components/theme';
import { api } from '@/lib/api';
import { fmtDateTime, gmailLink } from '@/lib/format';
import { IconExternal } from '@/components/icons';

export default function RepliesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api(`/api/replies?page=${page}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page]);

  return (
    <AppShell title="Replies" subtitle={data ? `${data.total} replies · follow-ups have stopped for all of them` : ''}>
      {error && <Alert style={{ marginBottom: 16 }}>{error}</Alert>}
      {!data && !error && <Loading />}
      {data && data.items.length === 0 && (
        <Card>
          <Empty title="No replies yet" text="The inbox is checked every few minutes. Replies will show up here." />
        </Card>
      )}
      {data && data.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.items.map((r) => (
            <Card key={r.id}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Avatar name={r.name || r.company} email={r.email} size={44} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link href={`/leads/${r.leadId}`} style={{ fontSize: 16, fontWeight: 700, color: C.ink, textDecoration: 'none' }}>
                      {r.company || r.name || r.email}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
                    {[r.name && r.company ? r.name : '', r.email, r.phone].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {fmtDateTime(r.at)}
                    {r.repliedAfterStep ? ` · Replied after email ${r.repliedAfterStep}` : ''}
                  </div>
                  {r.subject && <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>{r.subject}</div>}
                  <div style={{ fontSize: 14, color: C.ink, marginTop: 6, whiteSpace: 'pre-wrap', lineHeight: 1.55, background: C.bg, borderRadius: 8, padding: 12 }}>{r.text || '(empty message)'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <LinkButton variant="success" size="sm" href={gmailLink(r.email)} target="_blank" rel="noopener noreferrer">
                    Open in Gmail
                    <IconExternal size={14} />
                  </LinkButton>
                  <Link href={`/leads/${r.leadId}`} style={buttonStyle('secondary', 'sm')}>
                    Lead details
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Prev
            </Button>
            <Button variant="secondary" size="sm" disabled={page * 50 >= data.total} onClick={() => setPage(page + 1)}>
              Next →
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
