// Reads every setting from environment variables (.env) and validates them.
const path = require('path');
const fs = require('fs');

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (fs.existsSync(file) && typeof process.loadEnvFile === 'function') process.loadEnvFile(file);
}

function bool(v, def = false) {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function int(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function list(v) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function readConfig(env = process.env) {
  const maxDailyLimit = Math.max(1, int(env.MAX_DAILY_LIMIT, 30));
  const cfg = {
    port: int(env.PORT, 5001),
    mongoUri: env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
    mongoDb: env.MONGODB_DB || 'myfollowup',
    adminUsername: env.ADMIN_USERNAME || '',
    adminPassword: env.ADMIN_PASSWORD || '',
    authSecret: env.AUTH_SECRET || '',
    sessionHours: int(env.SESSION_HOURS, 12),
    frontendUrls: list(env.FRONTEND_URL || 'http://localhost:3000'),
    publicBackendUrl: String(env.PUBLIC_BACKEND_URL || `http://localhost:${int(env.PORT, 5001)}`).replace(/\/+$/, ''),
    trustProxy: bool(env.TRUST_PROXY, false),

    fromName: env.FROM_NAME || 'Bhargav from SiteCraft',
    fromEmail: env.FROM_EMAIL || env.SMTP_USER || '',
    senderName: env.SENDER_NAME || 'Bhargav',
    signature: {
      closing: env.SIGNATURE_CLOSING !== undefined ? env.SIGNATURE_CLOSING : 'Best regards,',
      name: env.SIGNATURE_NAME !== undefined ? env.SIGNATURE_NAME : 'SiteCraft by Bhargav',
      phone: env.SIGNATURE_PHONE || '',
    },
    smtp: {
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: int(env.SMTP_PORT, 465),
      secure: bool(env.SMTP_SECURE, int(env.SMTP_PORT, 465) === 465),
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
    },
    imap: {
      host: env.IMAP_HOST || 'imap.gmail.com',
      port: int(env.IMAP_PORT, 993),
      secure: bool(env.IMAP_SECURE, true),
      user: env.IMAP_USER || env.SMTP_USER || '',
      pass: env.IMAP_PASS || env.SMTP_PASS || '',
      pollMinutes: Math.max(1, int(env.IMAP_POLL_MINUTES, 5)),
    },
    dryRun: bool(env.MAIL_DRY_RUN, false),
    // smtp (default) or gmail-api (HTTPS — for hosts that block SMTP ports)
    mailTransport: String(env.MAIL_TRANSPORT || (env.GMAIL_REFRESH_TOKEN ? 'gmail-api' : 'smtp')).trim().toLowerCase(),
    gmailApi: {
      clientId: env.GMAIL_CLIENT_ID || '',
      clientSecret: env.GMAIL_CLIENT_SECRET || '',
      refreshToken: env.GMAIL_REFRESH_TOKEN || '',
    },

    timezone: env.TIMEZONE || 'Asia/Kolkata',
    maxDailyLimit,
    defaults: {
      dailyLimit: Math.min(maxDailyLimit, Math.max(1, int(env.DAILY_LIMIT, 30))),
      startHour: int(env.SEND_START_HOUR, 9),
      endHour: int(env.SEND_END_HOUR, 19),
      gapMinutes: Math.max(1, int(env.SEND_GAP_MINUTES, 18)),
      skipSundays: bool(env.SKIP_SUNDAYS, true),
    },
  };
  return cfg;
}

function validateConfig(cfg) {
  const errors = [];
  if (!cfg.adminUsername) errors.push('ADMIN_USERNAME is missing');
  if (!cfg.adminPassword || cfg.adminPassword.length < 8) errors.push('ADMIN_PASSWORD is missing or shorter than 8 characters');
  if (!cfg.authSecret || cfg.authSecret.length < 32) errors.push('AUTH_SECRET is missing or shorter than 32 characters');
  if (!cfg.fromEmail) errors.push('FROM_EMAIL is missing');
  if (!['smtp', 'gmail-api'].includes(cfg.mailTransport)) errors.push('MAIL_TRANSPORT must be "smtp" or "gmail-api"');
  if (!cfg.dryRun && cfg.mailTransport === 'smtp' && (!cfg.smtp.host || !cfg.smtp.user || !cfg.smtp.pass)) errors.push('SMTP_HOST / SMTP_USER / SMTP_PASS are missing');
  if (!cfg.dryRun && cfg.mailTransport === 'gmail-api') {
    const g = cfg.gmailApi;
    if (!g.clientId || !g.clientSecret) errors.push('GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET are missing (needed for MAIL_TRANSPORT=gmail-api)');
    if (!g.refreshToken) errors.push('GMAIL_REFRESH_TOKEN is missing — run "npm run gmail-auth" once on your computer');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: cfg.timezone });
  } catch {
    errors.push(`TIMEZONE "${cfg.timezone}" is not valid`);
  }
  const d = cfg.defaults;
  if (!(d.startHour >= 0 && d.endHour <= 24 && d.startHour < d.endHour)) errors.push('SEND_START_HOUR / SEND_END_HOUR are not valid');
  return errors;
}

/** Non-fatal hints printed at startup. */
function configWarnings(cfg) {
  const w = [];
  const gmail = /gmail\.com$/i.test(cfg.smtp.host);
  if (gmail && cfg.fromEmail && cfg.smtp.user && cfg.fromEmail.toLowerCase() !== cfg.smtp.user.toLowerCase())
    w.push(`FROM_EMAIL (${cfg.fromEmail}) and SMTP_USER (${cfg.smtp.user}) are different — with Gmail, FROM_EMAIL must be the same Gmail address`);
  if (/your16letterapppassword|your-app-password/i.test(cfg.smtp.pass + cfg.imap.pass))
    w.push('SMTP_PASS / IMAP_PASS still contain the example text — add your Gmail App Password (myaccount.google.com/apppasswords)');
  if (gmail && /\s/.test(cfg.smtp.pass)) w.push('SMTP_PASS contains spaces — enter the Gmail App Password without spaces (16 letters)');
  return w;
}

/** True when PUBLIC_BACKEND_URL is a real address the lead can open (not localhost). */
function hasPublicUrl(cfg) {
  return Boolean(cfg.publicBackendUrl) && !/\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(cfg.publicBackendUrl);
}

module.exports = { hasPublicUrl, readConfig, validateConfig, configWarnings, loadDotEnv };
