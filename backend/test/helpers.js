const http = require('http');
const { createApp } = require('../src/app');
const { createMemoryRepo } = require('../src/db/memoryRepo');
const { createSender } = require('../src/services/sender');
const { readConfig } = require('../src/config');
const { zonedTimeToDate } = require('../src/lib/time');

const silent = { log() {}, error() {}, warn() {} };

/** IST wall-clock -> Date */
const ist = (y, m, d, h, min = 0) => zonedTimeToDate(y, m, d, h, min, 'Asia/Kolkata');

function makeConfig(over = {}) {
  return {
    ...readConfig({
      PORT: '5001',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'super-secret-pass',
      AUTH_SECRET: 'x'.repeat(40),
      FROM_EMAIL: 'bhargav.sitecraft@gmail.com',
      SMTP_USER: 'bhargav.sitecraft@gmail.com',
      FROM_NAME: 'Bhargav from SiteCraft',
      SENDER_NAME: 'Bhargav',
      PUBLIC_BACKEND_URL: 'https://api.example.test',
      FRONTEND_URL: 'http://localhost:3000',
      MAIL_DRY_RUN: 'false',
      DAILY_LIMIT: '10',
      MAX_DAILY_LIMIT: '10',
      SEND_GAP_MINUTES: '60',
      UNSUBSCRIBE_LINK: 'true',
      WARMUP: 'false',
    }),
    ...over,
  };
}

function fakeMailer({ failFor = [] } = {}) {
  const sent = [];
  return {
    sent,
    dryRun: false,
    async verify() {
      return { ok: true, message: 'fake' };
    },
    async send(mail) {
      if (failFor.includes(mail.to)) throw new Error('SMTP refused');
      sent.push(mail);
      return { messageId: mail.messageId };
    },
  };
}

async function startServer(opts = {}) {
  const config = makeConfig(opts.config);
  const repo = createMemoryRepo();
  await require('../src/services/admin').ensureAdminSeeded(repo, config, silent);
  const mailer = opts.mailer || fakeMailer();
  const imapPoller = { configured: false, async pollOnce() { return { ok: false, message: 'not configured' }; } };
  const sender = createSender({ repo, mailer, config, logger: silent });
  const server = http.createServer(createApp({ repo, config, mailer, imapPoller, logger: silent }));
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token = null;
  async function api(method, path, body, extraHeaders = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    config,
    repo,
    mailer,
    sender,
    base,
    api,
    setToken: (t) => (token = t),
    close: () => new Promise((r) => server.close(r)),
  };
}

module.exports = { startServer, makeConfig, fakeMailer, ist, silent };
