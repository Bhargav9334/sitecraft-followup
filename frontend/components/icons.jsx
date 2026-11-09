// Line icons as React components (inline SVG, no extra package needed).
// They use the current text colour, so they match whatever text they sit next to.

function Svg({ size = 18, strokeWidth = 1.8, children, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export function IconDashboard(p) {
  return (
    <Svg {...p}>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </Svg>
  );
}

export function IconLeads(p) {
  return (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18.5 14.8c1.7.8 2.8 2.6 3 5.2" />
    </Svg>
  );
}

export function IconReplies(p) {
  return (
    <Svg {...p}>
      <path d="M21 12.5c0 4.1-4 7.5-9 7.5a10 10 0 0 1-3.6-.7L3 21l1.6-4.2A7 7 0 0 1 3 12.5C3 8.4 7 5 12 5s9 3.4 9 7.5z" />
      <path d="M10.5 10 8 12.5l2.5 2.5" />
      <path d="M8 12.5h5.5a2.5 2.5 0 0 1 2.5 2.5" />
    </Svg>
  );
}

export function IconSequence(p) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <path d="M5 8v8" />
      <path d="M10 6h11" />
      <path d="M10 12h8" />
      <path d="M10 18h11" />
    </Svg>
  );
}

export function IconUnsubscribed(p) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="5" width="15" height="11" rx="2" />
      <path d="m3 6 7 5 7-5" />
      <circle cx="18" cy="17" r="4" />
      <path d="m15.2 19.8 5.6-5.6" />
    </Svg>
  );
}

export function IconSettings(p) {
  return (
    <Svg {...p}>
      <path d="M4 6h9" />
      <path d="M17 6h3" />
      <circle cx="15" cy="6" r="2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <circle cx="9" cy="12" r="2" />
      <path d="M4 18h11" />
      <path d="M19 18h1" />
      <circle cx="17" cy="18" r="2" />
    </Svg>
  );
}

export function IconLogout(p) {
  return (
    <Svg {...p}>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M9 16l-4-4 4-4" />
      <path d="M5 12h10" />
    </Svg>
  );
}

export function IconUpload(p) {
  return (
    <Svg {...p}>
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </Svg>
  );
}

export function IconPlus(p) {
  return (
    <Svg {...p}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconStop(p) {
  return (
    <Svg {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconPlay(p) {
  return (
    <Svg {...p}>
      <path d="M7 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L8.5 4.6A1 1 0 0 0 7 5.5z" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconClock(p) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

export function IconExternal(p) {
  return (
    <Svg {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}
