import LegalPage, { h2 } from '@/components/legal/LegalPage';

export const metadata = { title: 'Terms of Service — SiteCraft Follow Up Software', robots: { index: true, follow: true } };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="10 November 2026">
      <p>SiteCraft Follow Up Software is a private tool operated by SiteCraft (by Bhargav) for its own use.</p>
      <h2 style={h2}>Use</h2>
      <p>Only the SiteCraft admin may log in. Access by anyone else is not allowed.</p>
      <h2 style={h2}>Emails</h2>
      <p>
        Emails are sent in small numbers (at most 10 a day) to businesses, each with an unsubscribe option. We honour
        every unsubscribe and removal request.
      </p>
      <h2 style={h2}>No warranty</h2>
      <p>The app is provided as is. SiteCraft may change or stop it at any time.</p>
      <h2 style={h2}>Contact</h2>
      <p>sitecraft94@gmail.com</p>
    </LegalPage>
  );
}
