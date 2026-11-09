// Reads the INBOX over IMAP every few minutes and hands new messages to
// handleIncoming(). Messages are fetched with PEEK, so they stay "unread" in Gmail.
const { handleIncoming } = require('./replies');

const FIRST_RUN_DAYS = 30;
const MAX_PER_POLL = 300;

function headerValue(headers, key) {
  const v = headers.get(key);
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.value) return String(v.value);
  if (v.text) return String(v.text);
  return String(v);
}

function toMsg(parsed) {
  const fromObj = parsed.from && parsed.from.value && parsed.from.value[0];
  const refs = parsed.references ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references]) : [];
  return {
    messageId: parsed.messageId || null,
    from: fromObj ? String(fromObj.address || '').toLowerCase() : '',
    fromName: fromObj ? fromObj.name || '' : '',
    subject: parsed.subject || '',
    text: stripQuoted(parsed.text || ''),
    date: parsed.date || new Date(),
    inReplyTo: parsed.inReplyTo || null,
    references: refs,
    headers: {
      'auto-submitted': headerValue(parsed.headers, 'auto-submitted'),
      'x-autoreply': headerValue(parsed.headers, 'x-autoreply'),
      'x-autorespond': headerValue(parsed.headers, 'x-autorespond'),
      precedence: headerValue(parsed.headers, 'precedence'),
    },
  };
}

/** Keeps only the new part of a reply (drops "On ... wrote:" and quoted lines). */
function stripQuoted(text) {
  const lines = String(text).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/i.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line.trim())) break;
    if (/^>/.test(line)) continue;
    out.push(line);
  }
  const res = out.join('\n').trim();
  return res || String(text).trim();
}

function explainImapError(e, config) {
  const detail = [e.responseText, e.serverResponseCode, e.code].filter(Boolean).join(' · ');
  if (e.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials|auth/i.test(detail + ' ' + e.message))
    return `Gmail login failed for ${config.imap.user} — check that IMAP_USER is the correct Gmail address and IMAP_PASS is a Gmail App Password (16 letters, no spaces)`;
  if (e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') return `Could not reach the IMAP server (${config.imap.host}:${config.imap.port}) — check your internet connection and IMAP_HOST`;
  return `${e.message}${detail ? ` (${detail})` : ''}`;
}

function createImapPoller({ repo, config, logger = console }) {
  let running = false;
  let lastResult = null;

  const configured = Boolean(config.imap.host && config.imap.user && config.imap.pass);

  async function pollOnce() {
    if (!configured) {
      lastResult = { at: new Date(), ok: false, message: 'IMAP is not configured in .env' };
      return lastResult;
    }
    if (running) return { ok: false, message: 'A check is already running' };
    running = true;
    const { ImapFlow } = require('imapflow');
    const { simpleParser } = require('mailparser');
    const client = new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: { user: config.imap.user, pass: config.imap.pass },
      logger: false,
    });
    const counts = { checked: 0, replied: 0, bounced: 0, auto: 0, unsubscribed: 0 };
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const saved = (await repo.getSettings()) || {};
        const state = saved.imapState || {};
        const uidValidity = String(client.mailbox.uidValidity);
        let uids;
        if (state.uidValidity !== uidValidity || !state.lastUid) {
          const since = new Date(Date.now() - FIRST_RUN_DAYS * 24 * 60 * 60 * 1000);
          uids = (await client.search({ since }, { uid: true })) || [];
        } else {
          uids = ((await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true })) || []).filter((u) => u > state.lastUid);
        }
        uids = uids.sort((a, b) => a - b).slice(0, MAX_PER_POLL);
        let maxUid = state.uidValidity === uidValidity ? state.lastUid || 0 : 0;
        const fetched = [];
        if (uids.length) {
          for await (const m of client.fetch(uids, { uid: true, source: true }, { uid: true })) fetched.push(m);
        }
        for (const m of fetched) {
          const parsed = await simpleParser(m.source);
          const res = await handleIncoming({ repo, msg: toMsg(parsed) });
          counts.checked++;
          if (res.action === 'replied') counts.replied++;
          if (res.action === 'bounced') counts.bounced++;
          if (res.action === 'auto-reply') counts.auto++;
          if (res.action === 'unsubscribed') counts.unsubscribed++;
          if (m.uid > maxUid) maxUid = m.uid;
        }
        await repo.saveSettings({ imapState: { uidValidity, lastUid: maxUid } });
      } finally {
        lock.release();
      }
      await client.logout();
      lastResult = { at: new Date(), ok: true, message: `Checked ${counts.checked} emails · ${counts.replied} replies · ${counts.bounced} bounces${counts.unsubscribed ? ` · ${counts.unsubscribed} unsubscribed` : ''}`, ...counts };
    } catch (e) {
      const msg = explainImapError(e, config);
      logger.error(`[imap] ${msg}`);
      lastResult = { at: new Date(), ok: false, message: msg };
      try {
        await client.logout();
      } catch {}
    } finally {
      running = false;
    }
    await repo.saveSettings({ lastImapPoll: lastResult });
    return lastResult;
  }

  return { pollOnce, configured, getLastResult: () => lastResult };
}

module.exports = { createImapPoller, stripQuoted, toMsg, explainImapError };
