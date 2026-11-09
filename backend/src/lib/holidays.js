// Central Government gazetted holidays (India) — DoPT list for 2026.
// Moon-based dates (Id, Muharram, Milad-un-Nabi) can shift by a day; edit them
// from the Settings page in the app whenever the official notice changes.
// Add next year's list from Settings once the government publishes it.

const DEFAULT_HOLIDAYS = [
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-04', name: 'Holi' },
  { date: '2026-03-21', name: 'Id-ul-Fitr' },
  { date: '2026-03-26', name: 'Ram Navami' },
  { date: '2026-03-31', name: 'Mahavir Jayanti' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-05-01', name: 'Buddha Purnima' },
  { date: '2026-05-27', name: 'Id-ul-Zuha (Bakrid)' },
  { date: '2026-06-26', name: 'Muharram' },
  { date: '2026-08-15', name: 'Independence Day' },
  { date: '2026-08-26', name: 'Milad-un-Nabi' },
  { date: '2026-09-04', name: 'Janmashtami' },
  { date: '2026-10-02', name: 'Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-08', name: 'Diwali' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  { date: '2026-12-25', name: 'Christmas' },
  // Fixed-date national holidays for 2027 (the rest get added when DoPT publishes the list)
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHolidays(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const h of list) {
    if (!h || typeof h.date !== 'string' || !DATE_RE.test(h.date.trim())) continue;
    const date = h.date.trim();
    if (seen.has(date)) continue;
    seen.add(date);
    out.push({ date, name: String(h.name || 'Holiday').trim().slice(0, 80) || 'Holiday' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function findHoliday(dateKey, holidays) {
  return (holidays || []).find((h) => h.date === dateKey) || null;
}

module.exports = { DEFAULT_HOLIDAYS, normalizeHolidays, findHoliday };
