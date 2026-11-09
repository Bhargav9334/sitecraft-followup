// SiteCraft logo: browser-window mark + "SiteCraft" wordmark + "by Bhargav".
// Inline SVG, so it needs no image files and stays sharp at every size.
import { LOGO_WIDTH, SITE_PATH, CRAFT_PATH, BY_PATH } from './brandPaths';

const BLUE = '#3D5AFE';

function MarkShapes({ bg = BLUE, fg = '#fff' }) {
  return (
    <>
      <rect width="48" height="48" rx="12" fill={bg} />
      <circle cx="11" cy="11" r="1.8" fill={fg} opacity=".55" />
      <circle cx="16.5" cy="11" r="1.8" fill={fg} opacity=".55" />
      <circle cx="22" cy="11" r="1.8" fill={fg} opacity=".55" />
      <path d="M32 19.5H20.5a4.25 4.25 0 0 0 0 8.5h7a4.25 4.25 0 0 1 0 8.5H16" fill="none" stroke={fg} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Square icon only. */
export function LogoMark({ size = 36, title = 'SiteCraft' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title} style={{ display: 'block', flexShrink: 0 }}>
      <MarkShapes />
    </svg>
  );
}

/**
 * Full logo. variant "dark" = for dark backgrounds (sidebar, login panel),
 * "light" = for white backgrounds.
 */
export default function Logo({ height = 40, variant = 'light', showBy = true }) {
  const colors =
    variant === 'dark' ? { site: '#FFFFFF', craft: '#8FA2FF', by: '#AEB6C5' } : { site: '#0E1525', craft: BLUE, by: '#5B6474' };
  return (
    <svg
      height={height}
      width={(height * LOGO_WIDTH) / 48}
      viewBox={`0 0 ${LOGO_WIDTH} 48`}
      role="img"
      aria-label="SiteCraft by Bhargav"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <MarkShapes />
      <path d={SITE_PATH} fill={colors.site} />
      <path d={CRAFT_PATH} fill={colors.craft} />
      {showBy && <path d={BY_PATH} fill={colors.by} />}
    </svg>
  );
}
