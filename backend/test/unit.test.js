const test = require('node:test');
const assert = require('node:assert/strict');
const { zonedParts, dayBounds } = require('../src/lib/time');
const { canSendNow, nextSendSlot } = require('../src/lib/schedule');
const { render, buildEmail } = require('../src/lib/template');
const { parseCsv, csvToLeads } = require('../src/lib/csv');
const { signToken, verifyToken } = require('../src/lib/auth');
const { isAutoReply } = require('../src/services/replies');
const { stripQuoted } = require('../src/services/imapPoller');
const { DEFAULT_HOLIDAYS } = require('../src/lib/holidays');
const { ist } = require('./helpers');

const settings = {
  paused: false,
  skipSundays: true,
  holidays: DEFAULT_HOLIDAYS,
  startHour: 9,
  endHour: 19,
  gapMinutes: 60,
  dailyLimit: 10,
  timezone: 'Asia/Kolkata',
};

test('IST helpers', () => {
  const d = ist(2026, 11, 9, 9, 0);
  assert.equal(d.toISOString(), '2026-11-09T03:30:00.000Z');
  const p = zonedParts(d, 'Asia/Kolkata');
  assert.equal(p.weekday, 1); // Monday
  const { start, end } = dayBounds(d, 'Asia/Kolkata');
  assert.equal(start.toISOString(), '2026-11-08T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-11-09T18:30:00.000Z');
});

test('sending window, gap, limit, Sunday, holiday, pause', () => {
  const s0 = { sentToday: 0, lastSentAt: null };
  assert.equal(canSendNow(ist(2026, 11, 9, 8, 59), settings, s0).ok, false); // before 9
  assert.equal(canSendNow(ist(2026, 11, 9, 9, 0), settings, s0).ok, true);
  assert.equal(canSendNow(ist(2026, 11, 9, 18, 59), settings, s0).ok, true); // last slot
  assert.equal(canSendNow(ist(2026, 11, 9, 19, 0), settings, s0).ok, false); // 7 PM stop
  assert.equal(canSendNow(ist(2026, 11, 9, 10, 30), settings, { sentToday: 1, lastSentAt: ist(2026, 11, 9, 10, 0) }).ok, false); // 1h gap
  assert.equal(canSendNow(ist(2026, 11, 9, 11, 0), settings, { sentToday: 1, lastSentAt: ist(2026, 11, 9, 10, 0) }).ok, true);
  assert.match(canSendNow(ist(2026, 11, 9, 15, 0), settings, { sentToday: 10, lastSentAt: ist(2026, 11, 9, 14, 0) }).reason, /limit/);
  assert.match(canSendNow(ist(2026, 11, 15, 10, 0), settings, s0).reason, /Sunday/);
  assert.match(canSendNow(ist(2026, 11, 24, 10, 0), settings, s0).reason, /Guru Nanak/);
  assert.match(canSendNow(ist(2026, 11, 9, 10, 0), { ...settings, paused: true }, s0).reason, /paused/);
});

test('max 10 slots fit in 9 AM – 7 PM with 1 hour gap', () => {
  let state = { sentToday: 0, lastSentAt: null };
  let sent = 0;
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m++) {
      const now = ist(2026, 11, 9, h, m);
      if (canSendNow(now, settings, state).ok) {
        sent++;
        state = { sentToday: state.sentToday + 1, lastSentAt: now };
      }
    }
  }
  assert.equal(sent, 10);
});

test('next slot skips Sunday + holiday', () => {
  // Saturday 7 PM -> Sunday skipped -> Monday 9 AM
  const slot = nextSendSlot(ist(2026, 11, 14, 19, 30), settings, { sentToday: 3, lastSentAt: ist(2026, 11, 14, 18, 0) });
  assert.equal(slot.toISOString(), ist(2026, 11, 16, 9, 0).toISOString());
  // Monday 23 Nov evening -> 24 Nov holiday -> 25 Nov
  const slot2 = nextSendSlot(ist(2026, 11, 23, 20, 0), settings, { sentToday: 10, lastSentAt: ist(2026, 11, 23, 18, 0) });
  assert.equal(slot2.toISOString(), ist(2026, 11, 25, 9, 0).toISOString());
});

test('template variables + fallback + unsubscribe footer', () => {
  assert.equal(render('Hi {{first_name|there}} at {{ company }}', { first_name: '', company: 'ABC' }), 'Hi there at ABC');
  const mail = buildEmail({
    step: { subject: '', body: 'Hello {{first_name}} <b>' },
    index: 1,
    lead: { name: 'Ravi Kumar', company: 'X', threadSubject: 'Quick question' },
    unsubscribeUrl: 'https://api.x/u/tok',
    senderName: 'Bhargav',
  });
  assert.equal(mail.subject, 'Re: Quick question');
  assert.match(mail.text, /Hello Ravi/);
  assert.match(mail.text, /unsubscribe here: https:\/\/api\.x\/u\/tok/);
  assert.match(mail.html, /&lt;b&gt;/); // escaped
  assert.match(mail.html, /href="https:\/\/api\.x\/u\/tok"/);
});

test('CSV parsing: quotes, header aliases, custom columns', () => {
  const rows = parseCsv('a,b\n"x, y","he said ""hi"""\n');
  assert.deepEqual(rows[1], ['x, y', 'he said "hi"']);
  const { leads, error } = csvToLeads('Business Name,Email Address,Contact Person,City,Website Issue\nSharma Dental,INFO@sharma.in,Dr Sharma,Delhi,no website\n');
  assert.equal(error, null);
  assert.equal(leads[0].company, 'Sharma Dental');
  assert.equal(leads[0].email, 'INFO@sharma.in');
  assert.equal(leads[0].name, 'Dr Sharma');
  assert.equal(leads[0].custom.website_issue, 'no website');
  assert.match(csvToLeads('name,phone\na,1').error, /email/);
});

test('tokens: valid, tampered, expired', () => {
  const t = signToken({ sub: 'admin' }, 's'.repeat(40), 60);
  assert.equal(verifyToken(t, 's'.repeat(40)).sub, 'admin');
  assert.equal(verifyToken(t + 'x', 's'.repeat(40)), null);
  assert.equal(verifyToken(t, 'y'.repeat(40)), null);
  assert.equal(verifyToken(signToken({ sub: 'a' }, 's'.repeat(40), -5), 's'.repeat(40)), null);
});

test('auto-reply detection + quoted text stripping', () => {
  assert.equal(isAutoReply({ subject: 'Out of Office: back Monday', headers: {} }), true);
  assert.equal(isAutoReply({ subject: 'Re: hello', headers: { 'auto-submitted': 'auto-replied' } }), true);
  assert.equal(isAutoReply({ subject: 'Re: hello', headers: { 'auto-submitted': 'no' } }), false);
  assert.equal(stripQuoted('Yes please send\n\nOn Mon, 9 Nov 2026 Bhargav wrote:\n> old text'), 'Yes please send');
});

test('no public domain: footer asks to reply "unsubscribe", header uses mailto only', () => {
  const { composeForLead, unsubscribeInfo, unsubscribeHeaders } = require('../src/services/sender');
  const config = { fromEmail: 'me@gmail.com', publicBackendUrl: 'http://localhost:5001' };
  const lead = { name: 'Mohit', email: 'm@x.com', unsubToken: 'tok' };
  const info = unsubscribeInfo(config, lead);
  assert.equal(info.url, null);
  const h = unsubscribeHeaders(info);
  assert.equal(h['List-Unsubscribe'], '<mailto:me@gmail.com?subject=Unsubscribe>');
  assert.equal(h['List-Unsubscribe-Post'], undefined);
  const mail = composeForLead({ lead, step: { subject: 'Hi', body: 'Hello {{first_name}}' }, index: 0, config, settings: {} });
  assert.match(mail.text, /reply with "unsubscribe"/);
  assert.doesNotMatch(mail.text, /localhost/);
  assert.doesNotMatch(mail.html, /localhost/);
  assert.match(mail.html, /mailto:me@gmail\.com/);

  const pub = unsubscribeInfo({ ...config, publicBackendUrl: 'https://api.site.in' }, lead);
  assert.equal(pub.url, 'https://api.site.in/u/tok');
  assert.match(unsubscribeHeaders(pub)['List-Unsubscribe'], /^<https:\/\/api\.site\.in\/u\/tok>, <mailto:/);
});

test('unsubscribe reply detection ignores quoted text and normal replies', () => {
  const { isUnsubscribeRequest } = require('../src/services/replies');
  assert.equal(isUnsubscribeRequest({ subject: 'Unsubscribe', text: '' }), true);
  assert.equal(isUnsubscribeRequest({ subject: 'Re: A quick question', text: 'unsubscribe\n\nOn Mon, Bhargav wrote:\n> reply with "unsubscribe"' }), true);
  assert.equal(isUnsubscribeRequest({ subject: 'Re: A quick question', text: 'Please remove me.' }), true);
  assert.equal(isUnsubscribeRequest({ subject: 'Re: A quick question', text: 'Stop' }), true);
  assert.equal(isUnsubscribeRequest({ subject: 'Re: A quick question', text: 'Yes, interested. Call me tomorrow.\n\nOn Mon, Bhargav wrote:\n> just reply with "unsubscribe"' }), false);
  assert.equal(isUnsubscribeRequest({ subject: 'Re: A quick question', text: "Don't stop, tell me the price for a website" }), false);
});

test('Gmail API mailer: refreshes token, sends raw mail in the thread, reads real Message-ID', async () => {
  const { createMailer } = require('../src/services/mailer');
  const calls = [];
  const fakeFetch = async (url, opts = {}) => {
    calls.push({ url, opts });
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (url.includes('oauth2.googleapis.com/token')) return json(200, { access_token: 'AT', expires_in: 3600 });
    if (url.endsWith('/profile')) return json(200, { emailAddress: 'Me@gmail.com' });
    if (url.endsWith('/messages/send')) {
      const b = JSON.parse(opts.body);
      if (b.threadId === 'gone') return json(404, { error: { message: 'Not found' } });
      return json(200, { id: 'g1', threadId: b.threadId || 't1' });
    }
    if (url.includes('/messages/g1?format=metadata')) return json(200, { payload: { headers: [{ name: 'Message-Id', value: '<real@mail.gmail.com>' }] } });
    return json(500, {});
  };
  const config = { dryRun: false, mailTransport: 'gmail-api', fromEmail: 'me@gmail.com', fromName: 'Bhargav from SiteCraft', gmailApi: { clientId: 'c', clientSecret: 's', refreshToken: 'r' } };
  let built;
  const m = createMailer(config, console, { fetch: fakeFetch, buildRaw: async (o) => { built = o; return Buffer.from('raw mail ✓'); } });
  assert.equal(m.transport, 'gmail-api');
  assert.deepEqual(await m.verify(), { ok: true, message: 'Gmail API connected (Me@gmail.com)' });

  const r = await m.send({ fromName: 'Bhargav from SiteCraft', to: 'a@b.in', subject: 'Hi', text: 't', html: 'h', messageId: '<ours@gmail.com>', headers: { 'List-Unsubscribe': '<mailto:me@gmail.com>' } });
  assert.deepEqual(r, { messageId: '<real@mail.gmail.com>', threadId: 't1', gmailId: 'g1' });
  assert.equal(built.from, '"Bhargav from SiteCraft" <me@gmail.com>');
  assert.equal(built.headers['List-Unsubscribe'], '<mailto:me@gmail.com>');
  const sendCall = calls.find((c) => c.url.endsWith('/messages/send'));
  assert.equal(sendCall.opts.headers.Authorization, 'Bearer AT');
  assert.equal(JSON.parse(sendCall.opts.body).raw, Buffer.from('raw mail ✓').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  assert.equal(calls.filter((c) => c.url.includes('/token')).length, 1, 'access token is cached');

  // follow-up keeps the thread; an unknown old thread falls back to a new one
  assert.equal((await m.send({ to: 'a@b.in', subject: 'Re: Hi', text: 't', threadId: 't1' })).threadId, 't1');
  assert.equal((await m.send({ to: 'a@b.in', subject: 'Re: Hi', text: 't', threadId: 'gone' })).threadId, 't1');

  // wrong Gmail account is reported clearly
  const other = createMailer({ ...config, fromEmail: 'other@gmail.com' }, console, { fetch: fakeFetch });
  assert.match((await other.verify()).message, /connected to Me@gmail\.com, but FROM_EMAIL is other@gmail\.com/);
});

test('Gmail API token error explains what to do', async () => {
  const { createGmailApiClient } = require('../src/services/gmailApi');
  const c = createGmailApiClient({ clientId: 'c', clientSecret: 's', refreshToken: 'r' }, async () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }));
  await assert.rejects(c.profile(), /expired or was revoked — run "npm run gmail-auth" again/);
});

test('config: MAIL_TRANSPORT gmail-api needs client id/secret/refresh token, not SMTP', () => {
  const { readConfig, validateConfig } = require('../src/config');
  const base = { ADMIN_USERNAME: 'a', ADMIN_PASSWORD: 'longenough', AUTH_SECRET: 'x'.repeat(40), FROM_EMAIL: 'me@gmail.com' };
  assert.equal(readConfig(base).mailTransport, 'smtp');
  assert.match(validateConfig(readConfig(base)).join(), /SMTP_HOST \/ SMTP_USER \/ SMTP_PASS are missing/);
  const g = readConfig({ ...base, GMAIL_CLIENT_ID: 'c', GMAIL_CLIENT_SECRET: 's', GMAIL_REFRESH_TOKEN: 'r' });
  assert.equal(g.mailTransport, 'gmail-api', 'refresh token present -> gmail-api automatically');
  assert.deepEqual(validateConfig(g), []);
  assert.match(validateConfig(readConfig({ ...base, MAIL_TRANSPORT: 'gmail-api' })).join(), /GMAIL_REFRESH_TOKEN is missing/);
  assert.match(validateConfig(readConfig({ ...base, MAIL_TRANSPORT: 'pigeon' })).join(), /MAIL_TRANSPORT must be/);
});
