import LegalPage, { h2 } from '@/components/legal/LegalPage';

export const metadata = { title: 'SiteCraft Follow Up Software — About', robots: { index: true, follow: true } };

export default function About() {
  return (
    <LegalPage title="SiteCraft Follow Up Software">
      <p>
        SiteCraft Follow Up Software is a private tool used by SiteCraft (by Bhargav) to send short, personal emails to
        businesses that may need a website or custom software, and to follow up a few times if there is no reply.
      </p>
      <h2 style={h2}>What it does</h2>
      <ul>
        <li>Sends at most 30 emails a day, spaced through business hours, from SiteCraft's own Gmail account.</li>
        <li>Stops all follow-ups as soon as a person replies, so the conversation continues normally in Gmail.</li>
        <li>Every email has an unsubscribe option. Anyone who unsubscribes is never emailed again.</li>
      </ul>
      <h2 style={h2}>Who can use it</h2>
      <p>Only the SiteCraft admin account can log in. It is not open for public sign-up.</p>
    </LegalPage>
  );
}
