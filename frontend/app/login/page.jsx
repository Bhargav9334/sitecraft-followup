'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveSession, getToken } from '@/lib/api';
import { C, FONT } from '@/components/theme';
import { Button, Field, inputStyle, Alert } from '@/components/ui';
import { useWidth } from '@/lib/useWidth';
import Logo from '@/components/Logo';

const STEPS = ['Email 1', '+3 days', '+7 days', '+7 days', '+10 days', '+15 days'];

export default function LoginPage() {
  const router = useRouter();
  const width = useWidth();
  const wide = width >= 960;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: { username, password } });
      saveSession(res.token, res.expiresInHours);
      router.replace('/dashboard');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: FONT, background: C.white }}>
      {wide && (
        <div style={{ width: '44%', background: C.side, padding: 64, boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
          <div>
            <Logo variant="dark" height={52} />
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B7590' }}>Follow Up Software</div>
          </div>
          <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
            <h2 style={{ color: '#fff', fontSize: 38, lineHeight: 1.25, margin: 0, maxWidth: 480 }}>Reach every lead — with automatic follow-ups.</h2>
            <p style={{ color: C.sideText, fontSize: 16, lineHeight: 1.6, maxWidth: 460, marginTop: 20 }}>
              Every lead gets a 6-email sequence. The moment they reply, follow-ups stop and the conversation continues in Gmail.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28 }}>
              {STEPS.map((s, i) => (
                <span key={i} style={{ background: i < 3 ? C.accent : C.side2, color: '#fff', fontSize: 12, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}>
                  {s}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 14, display: 'inline-block', background: '#12352A', color: '#7EE2B0', fontSize: 13, fontWeight: 600, padding: '10px 14px', borderRadius: 8 }}>
              ✓ Reply received → sequence stops
            </div>
          </div>
          <div style={{ color: '#6B7590', fontSize: 12 }}>10 emails/day · 9 AM – 7 PM · No emails on Sundays & public holidays</div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 420 }} noValidate>
          {!wide && (
            <div style={{ marginBottom: 36 }}>
              <Logo height={44} />
            </div>
          )}
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700, color: C.ink }}>Welcome back</h1>
          <p style={{ margin: '8px 0 32px', color: C.sub, fontSize: 15 }}>Log in to your account</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Username" htmlFor="username">
              <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ ...inputStyle, height: 46 }} />
            </Field>
            <Field label="Password" htmlFor="password">
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ ...inputStyle, height: 46, paddingRight: 70 }}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 6, top: 6, height: 34, padding: '0 10px', border: 0, background: 'transparent', color: C.accent, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" disabled={loading || !username || !password} style={{ width: '100%' }}>
              {loading ? 'Logging in…' : 'Login'}
            </Button>
          </div>

          <div style={{ marginTop: 28, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.ink }}>Secure login</div>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
              Only the admin account can log in. After 5 failed attempts, login is locked for 15 minutes. Sessions expire automatically.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
