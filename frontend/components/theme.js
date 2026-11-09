// Colours & fonts shared by every screen (same palette as the Figma design).
export const C = {
  bg: '#F6F7F9',
  white: '#FFFFFF',
  ink: '#0E1525',
  sub: '#5B6474',
  muted: '#7A8394',
  line: '#E4E7EC',
  side: '#0E1525',
  side2: '#1D2740',
  sideText: '#AEB6C5',
  accent: '#3D5AFE',
  accentDark: '#2C45D8',
  accentSoft: '#EEF1FF',
  green: '#0B7F47',
  greenSoft: '#E7F6EE',
  amber: '#8F5600',
  amberSoft: '#FFF4E0',
  red: '#B42318',
  redSoft: '#FDECEC',
  purple: '#6D3FD6',
  purpleSoft: '#F2ECFD',
};

export const FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const STATUS = {
  queued: { label: 'Queue', fg: C.sub, bg: '#EEF0F3' },
  active: { label: 'In sequence', fg: C.accent, bg: C.accentSoft },
  replied: { label: 'Replied', fg: C.green, bg: C.greenSoft },
  completed: { label: 'No reply (all 6 sent)', fg: C.amber, bg: C.amberSoft },
  stopped: { label: 'Stopped', fg: C.sub, bg: '#EEF0F3' },
  unsubscribed: { label: 'Unsubscribed', fg: C.red, bg: C.redSoft },
  bounced: { label: 'Bounced', fg: C.red, bg: C.redSoft },
};
