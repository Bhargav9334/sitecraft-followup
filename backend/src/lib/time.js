// Time helpers that work in a fixed business timezone (default Asia/Kolkata)
// without any external date library.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatterCache = new Map();

function getFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hourCycle: 'h23',
      })
    );
  }
  return formatterCache.get(timeZone);
}

/**
 * Returns the calendar parts of `date` as seen in `timeZone`.
 * { dateKey: 'YYYY-MM-DD', year, month, day, hour, minute, weekday: 0-6 (0 = Sunday) }
 */
function zonedParts(date, timeZone) {
  const parts = {};
  for (const p of getFormatter(timeZone).formatToParts(date)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(parts.weekday),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** Offset (ms) of the timezone from UTC at the given instant. */
function tzOffsetMs(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const actual = Math.floor(date.getTime() / 60000) * 60000;
  return asUtc - actual;
}

/** Builds a real Date for a wall-clock time (y, m, d, h, min) in `timeZone`. */
function zonedTimeToDate(year, month, day, hour, minute, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = tzOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

/** Start (00:00) and end (next day 00:00) of the business day containing `date`. */
function dayBounds(date, timeZone) {
  const p = zonedParts(date, timeZone);
  const start = zonedTimeToDate(p.year, p.month, p.day, 0, 0, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  const end = zonedTimeToDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, timeZone);
  return { start, end };
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

module.exports = { zonedParts, zonedTimeToDate, dayBounds, addDays, addMinutes, WEEKDAYS };
