// One-time: connect your Gmail account to the Gmail API (for hosting where SMTP is blocked).
//   1. Download the OAuth client JSON (Desktop app) from Google Cloud — it lands in ~/Downloads
//      (or put GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in backend/.env yourself)
//   2. Run:  npm run gmail-auth        (or: npm run gmail-auth -- /path/to/client_secret.json)
//   3. Allow access in the browser with your sending Gmail account
// The refresh token is saved into backend/.env as GMAIL_REFRESH_TOKEN.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { loadDotEnv } = require('../src/config');
const { SCOPES, TOKEN_URL } = require('../src/services/gmailApi');

loadDotEnv();
const ENV_FILE = path.join(__dirname, '..', '.env');

/** Reads id/secret from a Google client JSON: the path given, or the newest client_secret*.json in ~/Downloads. */
function clientFromJson() {
  let file = process.argv[2];
  if (!file) {
    const dl = path.join(require('os').homedir(), 'Downloads');
    try {
      file = fs.readdirSync(dl)
        .filter((f) => /^client_secret.*\.json$/i.test(f))
        .map((f) => path.join(dl, f))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    } catch {
      file = null;
    }
  }
  if (!file) return null;
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = j.installed || j.web || {};
  if (!c.client_id || !c.client_secret) throw new Error(`${file} is not an OAuth client file`);
  console.log(`Using Google client file: ${path.basename(file)}`);
  return { id: c.client_id, secret: c.client_secret };
}

const real = (v) => (v && !/^(yaha|your|xxx|change)/i.test(v) && !/[<>\s]/.test(v) ? v : '');
let clientId = real(process.env.GMAIL_CLIENT_ID);
let clientSecret = real(process.env.GMAIL_CLIENT_SECRET);
const fromFile = process.argv[2] || !clientId || !clientSecret ? clientFromJson() : null;
if (fromFile) {
  clientId = fromFile.id;
  clientSecret = fromFile.secret;
}
const fromEmail = (process.env.FROM_EMAIL || '').toLowerCase();
const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}/callback`;

if (!clientId || !clientSecret) {
  console.error('\nNo Google client found. Download the OAuth client JSON (Desktop app) into ~/Downloads, or add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to backend/.env.\n');
  process.exit(1);
}

function saveEnv(key, value) {
  let s = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  s = re.test(s) ? s.replace(re, line) : s.replace(/\n*$/, '\n') + line + '\n';
  fs.writeFileSync(ENV_FILE, s);
}

const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    ...(fromEmail ? { login_hint: fromEmail } : {}),
  }).toString();

const page = (title, msg) => `<!doctype html><meta charset="utf-8"><body style="font-family:Arial;padding:40px"><h2>${title}</h2><p>${msg}</p></body>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== '/callback') return res.writeHead(404).end();
  const code = url.searchParams.get('code');
  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/html' }).end(page('Not connected', `Google said: ${url.searchParams.get('error') || 'no code'}. Close this tab and run the command again.`));
    return finish(1);
  }
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }).toString(),
    });
    const data = await r.json();
    if (!r.ok || !data.refresh_token) throw new Error(data.error_description || data.error || 'No refresh token returned — remove the app at myaccount.google.com/permissions and try again');
    const p = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${data.access_token}` } }).then((x) => x.json());
    if (fromEmail && String(p.emailAddress).toLowerCase() !== fromEmail) throw new Error(`You allowed ${p.emailAddress}, but FROM_EMAIL is ${fromEmail}. Run again and pick ${fromEmail}.`);
    saveEnv('GMAIL_CLIENT_ID', clientId);
    saveEnv('GMAIL_CLIENT_SECRET', clientSecret);
    saveEnv('GMAIL_REFRESH_TOKEN', data.refresh_token);
    // Your computer keeps sending over SMTP; only the hosted server (Render) uses MAIL_TRANSPORT=gmail-api.
    if (!process.env.MAIL_TRANSPORT) saveEnv('MAIL_TRANSPORT', 'smtp');
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(page('Gmail connected ✓', `${p.emailAddress} can now send through the Gmail API. You can close this tab.`));
    console.log(`\n✓ Connected ${p.emailAddress}. GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN were saved in backend/.env (this computer still sends over SMTP)`);
    console.log('  For hosting (Render): copy GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and GMAIL_REFRESH_TOKEN from backend/.env into the service environment.\n');
    finish(0);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/html' }).end(page('Not connected', String(e.message)));
    console.error('\n✗ ' + e.message + '\n');
    finish(1);
  }
});

function finish(code) {
  setTimeout(() => server.close(() => process.exit(code)), 300);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('\nOpen this link, choose ' + (fromEmail || 'your Gmail') + ' and click Allow:\n\n' + authUrl + '\n');
  if (process.platform === 'darwin') execFile('open', [authUrl], () => {});
});
