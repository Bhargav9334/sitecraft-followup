import { FONT, C } from '@/components/theme';

export const metadata = {
  title: 'SiteCraft — Follow Up Software',
  description: 'Email follow-up CRM — SiteCraft by Bhargav',
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: FONT, background: C.bg, color: C.ink, WebkitFontSmoothing: 'antialiased' }}>{children}</body>
    </html>
  );
}
