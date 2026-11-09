import LegalPage, { h2 } from '@/components/legal/LegalPage';

export const metadata = { title: 'Privacy Policy — SiteCraft Follow Up Software', robots: { index: true, follow: true } };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="10 November 2026">
      <p>
        This policy explains how SiteCraft Follow Up Software ("the app"), run by SiteCraft (by Bhargav), handles
        information. The app is used only by the SiteCraft admin.
      </p>

      <h2 style={h2}>Google account data</h2>
      <p>The app connects to the SiteCraft Gmail account (sitecraft94@gmail.com) with these permissions:</p>
      <ul>
        <li><b>Send email</b> (gmail.send): to send outreach and follow-up emails from that account.</li>
        <li><b>Read email headers</b> (gmail.metadata): only to read the Message-ID of emails the app has sent, so replies are matched to the right conversation. Email bodies are not read through this permission.</li>
      </ul>
      <p>
        Google data is used only to provide these features. It is not sold, shared with third parties, used for
        advertising, or used to train AI models. The app's use of information received from Google APIs follows the{' '}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.
      </p>

      <h2 style={h2}>Information about email recipients</h2>
      <p>
        The app stores the business name, contact name, business email, phone, city and website of the businesses
        we contact. This comes from public business listings and websites. It also stores which emails were sent and
        any replies, so follow-ups stop when someone replies.
      </p>

      <h2 style={h2}>Unsubscribing and removal</h2>
      <p>
        Every email has an unsubscribe link, and replying "unsubscribe" works too. Unsubscribed addresses are never
        emailed again. To have your details deleted, email sitecraft94@gmail.com and we will remove them.
      </p>

      <h2 style={h2}>Storage and security</h2>
      <p>
        Data is stored in a secured MongoDB database. Access needs the admin login. Connection secrets are kept in
        server settings, not in the code.
      </p>

      <h2 style={h2}>Revoking access</h2>
      <p>
        The Gmail connection can be removed at any time from{' '}
        <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
      </p>

      <h2 style={h2}>Contact</h2>
      <p>Questions about this policy: sitecraft94@gmail.com</p>
    </LegalPage>
  );
}
