'use client';
// Small building blocks used across all screens. Styling is inline (no CSS files).
import { useEffect } from 'react';
import { C, STATUS } from './theme';
import { initials } from '@/lib/format';

const btnBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  border: '1px solid transparent',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
  textDecoration: 'none',
  lineHeight: 1,
};
const variants = {
  primary: { background: C.accent, color: '#fff' },
  secondary: { background: C.white, color: C.ink, border: `1px solid ${C.line}` },
  danger: { background: C.redSoft, color: C.red, border: `1px solid #F7C9C5` },
  success: { background: C.green, color: '#fff' },
  dark: { background: C.ink, color: '#fff' },
  ghost: { background: 'transparent', color: C.sub },
};
const sizes = { sm: { height: 34, padding: '0 12px', fontSize: 13 }, md: { height: 40, padding: '0 16px' }, lg: { height: 46, padding: '0 20px', fontSize: 15 } };

/** Style object so a Next <Link> can look like a button (no <button> inside <a>). */
export function buttonStyle(variant = 'primary', size = 'md') {
  return { ...btnBase, ...variants[variant], ...sizes[size] };
}

export function Button({ variant = 'primary', size = 'md', style, disabled, children, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{ ...btnBase, ...variants[variant], ...sizes[size], ...(disabled ? { opacity: 0.55, cursor: 'not-allowed' } : {}), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({ variant = 'secondary', size = 'md', style, children, ...rest }) {
  return (
    <a style={{ ...btnBase, ...variants[variant], ...sizes[size], ...style }} {...rest}>
      {children}
    </a>
  );
}

export function Card({ title, subtitle, right, children, style, pad = 20 }) {
  return (
    <section style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 12, padding: pad, minWidth: 0, ...style }}>
      {(title || right) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            {title && <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</h2>}
            {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: C.sub }}>{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ fg = C.sub, bg = '#EEF0F3', children, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, color: fg, background: bg, whiteSpace: 'nowrap', ...style }}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, fg: C.sub, bg: '#EEF0F3' };
  return (
    <Badge fg={s.fg} bg={s.bg}>
      {s.label}
    </Badge>
  );
}

/** 6 small bars: blue = sent, green = reply came after this mail, grey = pending */
export function StepBars({ step = 0, total = 6, status, repliedAfterStep }) {
  const replyAt = status === 'replied' ? repliedAfterStep || step : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label={`${step} of ${total} mails sent`}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => {
          const sent = i < step;
          const isReply = replyAt && i === replyAt - 1;
          return <span key={i} style={{ width: 16, height: 8, borderRadius: 4, background: isReply ? C.green : sent ? C.accent : C.line }} />;
        })}
      </div>
      <span style={{ fontSize: 12, color: C.sub, fontWeight: 500 }}>
        {step}/{total}
      </span>
    </div>
  );
}

export function Avatar({ name, email, size = 36 }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: '50%', background: '#E3E8FF', color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, flexShrink: 0 }}
    >
      {initials(name, email)}
    </span>
  );
}

export const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  height: 42,
  borderRadius: 8,
  border: `1px solid ${C.line}`,
  padding: '0 12px',
  fontSize: 14,
  color: C.ink,
  background: C.white,
  fontFamily: 'inherit',
};

export function Field({ label, hint, children, htmlFor, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, ...style }}>
      {label && (
        <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 500, color: C.ink }}>
          {label}
        </label>
      )}
      {children}
      {hint && <span style={{ fontSize: 12, color: C.muted }}>{hint}</span>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 999, border: 0, padding: 0, background: checked ? C.accent : '#C9CED8', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer, width = 560 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(14,21,37,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 16px', zIndex: 50, overflowY: 'auto' }}
    >
      <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: width, boxShadow: '0 20px 50px rgba(14,21,37,.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.line}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 22, lineHeight: 1, cursor: 'pointer', color: C.muted, width: 36, height: 36 }}>
            ×
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, text, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 16px', color: C.sub }}>
      <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>{title}</p>
      {text && <p style={{ margin: '6px 0 0', fontSize: 14 }}>{text}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  return <p style={{ color: C.sub, fontSize: 14, padding: 24 }}>{text}</p>;
}

export function Alert({ kind = 'error', children, style }) {
  const map = { error: [C.red, C.redSoft], success: [C.green, C.greenSoft], info: [C.accent, C.accentSoft], warn: [C.amber, C.amberSoft] };
  const [fg, bg] = map[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} style={{ background: bg, color: fg, borderRadius: 10, padding: '12px 14px', fontSize: 14, fontWeight: 500, lineHeight: 1.45, ...style }}>
      {children}
    </div>
  );
}

export const th = { textAlign: 'left', fontSize: 11, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: C.muted, padding: '14px 16px', borderBottom: `1px solid ${C.line}`, background: '#FAFBFC', whiteSpace: 'nowrap' };
export const td = { padding: '14px 16px', borderBottom: `1px solid ${C.line}`, fontSize: 14, color: C.ink, verticalAlign: 'middle' };
