import Link from 'next/link';
import { C } from '@/components/theme';
import Logo from '@/components/Logo';

const wrap = { maxWidth: 760, margin: '0 auto', padding: '40px 20px 64px', lineHeight: 1.65, fontSize: 15 };
const nav = { display: 'flex', gap: 16, fontSize: 14, marginTop: 8, flexWrap: 'wrap' };
const link = { color: C.accent, textDecoration: 'none' };

/** Public page shell (no login) used for About, Privacy Policy and Terms. */
export default function LegalPage({ title, updated, children }) {
  return (
    <main style={wrap}>
      <Logo />
      <nav style={nav}>
        <Link href="/about" style={link}>About</Link>
        <Link href="/privacy" style={link}>Privacy Policy</Link>
        <Link href="/terms" style={link}>Terms of Service</Link>
        <Link href="/login" style={link}>Login</Link>
      </nav>
      <h1 style={{ fontSize: 28, margin: '32px 0 4px', color: C.ink }}>{title}</h1>
      {updated && <p style={{ margin: '0 0 24px', color: C.sub, fontSize: 13 }}>Last updated: {updated}</p>}
      <div style={{ color: C.ink }}>{children}</div>
      <p style={{ marginTop: 48, fontSize: 13, color: C.sub }}>SiteCraft by Bhargav · Contact: sitecraft94@gmail.com</p>
    </main>
  );
}

export const h2 = { fontSize: 18, margin: '28px 0 8px' };
