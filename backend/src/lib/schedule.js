// Decides WHEN a mail may go out. Pure functions — easy to test.
const { zonedParts, zonedTimeToDate, addMinutes, addDays } = require('./time');
const { findHoliday } = require('./holidays');

/**
 * Why sending is blocked on a given calendar day (or null if the day is open).
 */
function dayBlockReason(date, settings) {
  const p = zonedParts(date, settings.timezone);
  if (settings.skipSundays && p.weekday === 0) return 'Sunday — no emails';
  const holiday = findHoliday(p.dateKey, settings.holidays);
  if (holiday) return `Holiday — ${holiday.name}`;
  return null;
}

/**
 * Can one mail be sent right now?
 * state = { sentToday, lastSentAt }
 * returns { ok, reason }
 */
function canSendNow(now, settings, state) {
  if (settings.paused) return { ok: false, reason: 'System paused' };
  const dayReason = dayBlockReason(now, settings);
  if (dayReason) return { ok: false, reason: dayReason };
  const p = zonedParts(now, settings.timezone);
  if (p.hour < settings.startHour) return { ok: false, reason: `Sending starts at ${fmtHour(settings.startHour)}` };
  if (p.hour >= settings.endHour) return { ok: false, reason: `Sending window closed for today (${fmtHour(settings.endHour)})` };
  if (state.sentToday >= settings.dailyLimit) return { ok: false, reason: `Daily limit reached (${settings.dailyLimit}/${settings.dailyLimit})` };
  if (state.lastSentAt) {
    const nextAllowed = addMinutes(new Date(state.lastSentAt), settings.gapMinutes);
    if (now < nextAllowed) return { ok: false, reason: `Waiting for the gap — next email after ${fmtTime(nextAllowed, settings.timezone)}` };
  }
  return { ok: true, reason: 'Ready' };
}

/**
 * Estimates the next moment a mail could go out (ignores whether a lead is due).
 * Walks forward minute-slots day by day; max 30 days.
 */
function nextSendSlot(now, settings, state) {
  if (settings.paused) return null;
  let candidate = new Date(now);
  if (state.lastSentAt) {
    const gapEnd = addMinutes(new Date(state.lastSentAt), settings.gapMinutes);
    if (gapEnd > candidate) candidate = gapEnd;
  }
  let sentToday = state.sentToday;
  const startKey = zonedParts(now, settings.timezone).dateKey;
  for (let i = 0; i < 31; i++) {
    const p = zonedParts(candidate, settings.timezone);
    if (p.dateKey !== startKey) sentToday = 0;
    const blocked = dayBlockReason(candidate, settings) || sentToday >= settings.dailyLimit || p.hour >= settings.endHour;
    if (!blocked) {
      if (p.hour < settings.startHour) {
        return zonedTimeToDate(p.year, p.month, p.day, settings.startHour, 0, settings.timezone);
      }
      return candidate;
    }
    // jump to next day's start hour
    const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
    candidate = zonedTimeToDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), settings.startHour, 0, settings.timezone);
  }
  return null;
}

/** When the follow-up after `sentAt` becomes due. */
function followUpDueAt(sentAt, delayDays) {
  return addDays(new Date(sentAt), Number(delayDays) || 0);
}

function fmtHour(h) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${suffix}`;
}

function fmtTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-IN', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
}

module.exports = { canSendNow, nextSendSlot, followUpDueAt, dayBlockReason, fmtHour };
