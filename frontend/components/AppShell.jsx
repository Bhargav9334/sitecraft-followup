'use client';
// Sidebar + top bar + login guard + global Start/Stop switch for every inner page.
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { C, FONT } from './theme';
import { api, getToken, clearSession } from '@/lib/api';
import { useWidth } from '@/lib/useWidth';
import { Button } from './ui';
import Logo from './Logo';
import { IconDashboard, IconLeads, IconReplies, IconSequence, IconUnsubscribed, IconSettings, IconLogout, IconPlay, IconStop } from './icons';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { href: '/leads', label: 'Leads', Icon: IconLeads },
  { href: '/replies', label: 'Replies', Icon: IconReplies },
  { href: '/sequence', label: 'Sequence', Icon: IconSequence },
  { href: '/unsubscribed', label: 'Unsubscribed', Icon: IconUnsubscribed },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
];

export const SYSTEM_EVENT = 'fus:system-changed';

export default function AppShell({ title, subtitle, actions, children }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const width = useWidth();
  const mobile = width < 900;
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState('');
  const [paused, setPaused] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadSystem = useCallback(() => {
    api('/api/settings')
      .then((s) => setPaused(s.paused))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
    api('/api/auth/me')
      .then((m) => setUser(m.username))
      .catch(() => {});
    loadSystem();
    window.addEventListener(SYSTEM_EVENT, loadSystem);
    return () => window.removeEventListener(SYSTEM_EVENT, loadSystem);
  }, [router, loadSystem]);

  async function toggleSystem() {
    setBusy(true);
    try {
      const s = await api(paused ? '/api/system/resume' : '/api/system/pause', { method: 'POST' });
      setPaused(s.paused);
      window.dispatchEvent(new Event(SYSTEM_EVENT));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearSession();
    router.replace('/login');
  }

  if (!ready) return <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }} />;

  const navLink = (n) => {
    const on = pathname === n.href || pathname.startsWith(n.href + '/');
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={on ? 'page' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: mobile ? '8px 12px' : '10px 14px',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: on ? 600 : 500,
          color: on ? '#fff' : C.sideText,
          background: on ? C.side2 : 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        <n.Icon size={19} />
        {n.label}
      </Link>
    );
  };

  const systemButton =
    paused === null ? null : (
      <Button variant={paused ? 'success' : 'danger'} size="sm" onClick={toggleSystem} disabled={busy} title={paused ? 'Resume automatic emails' : 'Stop all automatic emails right now'}>
        {paused ? <IconPlay size={14} /> : <IconStop size={14} />}
        {paused ? 'Start system' : 'Stop system'}
      </Button>
    );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.ink, display: 'flex', flexDirection: mobile ? 'column' : 'row' }}>
      {mobile ? (
        <header style={{ background: C.side, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Logo variant="dark" height={34} />
            <Button variant="ghost" size="sm" onClick={logout} style={{ color: C.sideText }}>
              Logout
            </Button>
          </div>
          <nav aria-label="Main" style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
            {NAV.map(navLink)}
          </nav>
        </header>
      ) : (
        <aside style={{ width: 240, flexShrink: 0, background: C.side, display: 'flex', flexDirection: 'column', padding: '24px 12px', boxSizing: 'border-box', position: 'sticky', top: 0, height: '100vh' }}>
          <div style={{ padding: '0 12px 6px' }}>
            <Logo variant="dark" height={42} />
          </div>
          <div style={{ padding: '0 12px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B7590' }}>Follow Up Software</div>
          <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(navLink)}
          </nav>
          <div style={{ marginTop: 'auto', padding: '0 4px' }}>
            <div style={{ background: '#18213A', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.sideText }}>Automatic sending</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: paused ? '#F97066' : '#32D583' }} />
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{paused === null ? '…' : paused ? 'Stopped' : 'Running'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
              <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%', background: '#2E3A5A', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {(user || 'A').slice(0, 2).toUpperCase()}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user || 'Admin'}</div>
                <button type="button" onClick={logout} style={{ background: 'none', border: 0, padding: 0, color: C.sideText, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <IconLogout size={13} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.white, borderBottom: `1px solid ${C.line}`, padding: mobile ? '14px 16px' : '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: mobile ? 19 : 22, fontWeight: 700 }}>{title}</h1>
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.sub }}>{subtitle}</p>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {actions}
            {systemButton}
          </div>
        </div>
        {paused && (
          <div role="status" style={{ background: C.redSoft, color: C.red, padding: '10px 32px', fontSize: 14, fontWeight: 600 }}>
            System is stopped — no automatic emails will be sent until you click “Start system”.
          </div>
        )}
        <main style={{ padding: mobile ? 16 : 32, flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
