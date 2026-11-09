// Date helpers — everything is shown in Indian time.
const TZ = 'Asia/Kolkata';

export function fmtDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d));
}

export function fmtDateTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d));
}

export function fmtTime(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d));
}

export function hourOf(d) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date(d)));
}

export function hourLabel(h) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

export function timeAgo(d) {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function relDay(d) {
  if (!d) return '—';
  const t = new Date(d).getTime();
  if (t <= Date.now()) return 'Next free slot';
  return fmtDateTime(d);
}

export function initials(name, email) {
  const src = String(name || email || '?').replace(/^(dr|mr|mrs|ms)\.?\s+/i, '');
  return src
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function gmailLink(email) {
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`from:${email} OR to:${email}`)}`;
}
