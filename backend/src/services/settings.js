// Effective settings = values saved from the UI, falling back to .env defaults.
const { DEFAULT_HOLIDAYS, normalizeHolidays } = require('../lib/holidays');
const { DEFAULT_STEPS, STEP_COUNT } = require('../defaults');
const { clean, cleanMultiline } = require('../lib/validate');

async function getSettings(repo, config) {
  const saved = (await repo.getSettings()) || {};
  const d = config.defaults;
  return {
    paused: saved.paused === true,
    pausedAt: saved.pausedAt || null,
    skipSundays: saved.skipSundays !== undefined ? saved.skipSundays : d.skipSundays,
    holidays: saved.holidays ? normalizeHolidays(saved.holidays) : DEFAULT_HOLIDAYS,
    startHour: saved.startHour ?? d.startHour,
    endHour: saved.endHour ?? d.endHour,
    gapMinutes: saved.gapMinutes ?? d.gapMinutes,
    dailyLimit: Math.min(saved.dailyLimit ?? d.dailyLimit, config.maxDailyLimit),
    timezone: config.timezone,
    maxDailyLimit: config.maxDailyLimit,
    fromName: saved.fromName || config.fromName,
    fromEmail: config.fromEmail,
    senderName: saved.senderName !== undefined ? saved.senderName : config.senderName,
    signature: { ...config.signature, ...(saved.signature || {}) },
  };
}

/** Validates a settings update from the UI. Returns { patch } or { error }. */
function validateSettingsPatch(body, config) {
  const patch = {};
  if (body.paused !== undefined) {
    patch.paused = Boolean(body.paused);
    patch.pausedAt = patch.paused ? new Date() : null;
  }
  if (body.skipSundays !== undefined) patch.skipSundays = Boolean(body.skipSundays);
  if (body.holidays !== undefined) {
    if (!Array.isArray(body.holidays)) return { error: 'holidays must be a list' };
    patch.holidays = normalizeHolidays(body.holidays);
  }
  const intField = (key, min, max) => {
    if (body[key] === undefined) return null;
    const n = Number(body[key]);
    if (!Number.isInteger(n) || n < min || n > max) return `${key} must be between ${min} and ${max}`;
    patch[key] = n;
    return null;
  };
  const err =
    intField('startHour', 0, 23) ||
    intField('endHour', 1, 24) ||
    intField('gapMinutes', 1, 24 * 60) ||
    intField('dailyLimit', 1, config.maxDailyLimit);
  if (err) return { error: err };
  if (body.fromName !== undefined) {
    const v = clean(body.fromName, 80).replace(/["<>]/g, '');
    if (!v) return { error: 'From name cannot be empty' };
    patch.fromName = v;
  }
  if (body.senderName !== undefined) patch.senderName = clean(body.senderName, 60);
  if (body.signature !== undefined) {
    if (!body.signature || typeof body.signature !== 'object') return { error: 'Signature is not valid' };
    patch.signature = {
      closing: clean(body.signature.closing, 80),
      name: clean(body.signature.name, 100),
      phone: clean(body.signature.phone, 80),
    };
  }
  return { patch };
}

async function getSequence(repo) {
  const saved = await repo.getSequence();
  if (saved && Array.isArray(saved.steps) && saved.steps.length === STEP_COUNT) return saved;
  return { steps: DEFAULT_STEPS, updatedAt: null };
}

function validateSteps(steps) {
  if (!Array.isArray(steps) || steps.length !== STEP_COUNT) return { error: `The sequence must have exactly ${STEP_COUNT} emails` };
  const clean6 = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] || {};
    const body = cleanMultiline(s.body, 20000).trim();
    const subject = clean(s.subject, 200);
    if (!body) return { error: `Email ${i + 1} has an empty message` };
    if (i === 0 && !subject) return { error: 'Email 1 needs a subject' };
    const delay = i === 0 ? 0 : Number(s.delayDays);
    if (i > 0 && (!Number.isInteger(delay) || delay < 1 || delay > 90)) return { error: `The delay for email ${i + 1} must be 1–90 days` };
    clean6.push({ delayDays: delay, subject, body });
  }
  return { steps: clean6 };
}

module.exports = { getSettings, validateSettingsPatch, getSequence, validateSteps };
