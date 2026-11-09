// Sends mail through the Gmail API over HTTPS (port 443). Used on hosts that
// block SMTP ports (e.g. Render free). The mail still goes out from your own
// Gmail account, shows in Gmail "Sent", and keeps the same thread.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.metadata'];

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds the raw RFC 822 message (same headers nodemailer would send over SMTP). */
async function buildRaw(opts) {
  const MailComposer = require('nodemailer/lib/mail-composer');
  return new Promise((resolve, reject) => {
    new MailComposer(opts).compile().build((err, msg) => (err ? reject(err) : resolve(msg)));
  });
}

function createGmailApiClient({ clientId, clientSecret, refreshToken }, fetchImpl = globalThis.fetch) {
  let cached = null; // { token, exp }

  async function accessToken() {
    if (cached && cached.exp > Date.now() + 60_000) return cached.token;
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const why = data.error === 'invalid_grant' ? 'the Gmail token expired or was revoked — run "npm run gmail-auth" again' : data.error_description || data.error || `HTTP ${res.status}`;
      throw new Error(`Gmail API login failed: ${why}`);
    }
    cached = { token: data.access_token, exp: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
    return cached.token;
  }

  async function call(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(API + path, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`Gmail API: ${data.error?.message || `HTTP ${res.status}`}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    async profile() {
      return call('/profile');
    },
    /** raw = Buffer of the full message. Returns { id, threadId, messageId }. */
    async sendRaw(raw, threadId) {
      let sent;
      try {
        sent = await call('/messages/send', { method: 'POST', body: { raw: b64url(raw), ...(threadId ? { threadId } : {}) } });
      } catch (e) {
        if (!threadId || ![400, 404].includes(e.status)) throw e;
        sent = await call('/messages/send', { method: 'POST', body: { raw: b64url(raw) } }); // old/unknown thread: send as new
      }
      // Gmail may assign its own Message-ID — read it so reply threading stays exact.
      let messageId = null;
      try {
        const meta = await call(`/messages/${sent.id}?format=metadata&metadataHeaders=Message-ID`);
        const h = (meta.payload?.headers || []).find((x) => String(x.name).toLowerCase() === 'message-id');
        messageId = h ? h.value : null;
      } catch {
        /* keep our own Message-ID */
      }
      return { id: sent.id, threadId: sent.threadId, messageId };
    },
  };
}

module.exports = { createGmailApiClient, buildRaw, b64url, SCOPES, TOKEN_URL };
