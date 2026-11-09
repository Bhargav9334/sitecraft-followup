const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

function isEmail(v) {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
}

function clean(v, max = 200) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanMultiline(v, max = 20000) {
  if (v === undefined || v === null) return '';
  return String(v).replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
}

/** Validates & normalises user-provided lead data. Returns { lead } or { error }. */
function sanitizeLead(input) {
  const email = clean(input.email, 254).toLowerCase();
  if (!isEmail(email)) return { error: `Invalid email: "${clean(input.email, 80)}"` };
  const custom = {};
  if (input.custom && typeof input.custom === 'object') {
    for (const [k, v] of Object.entries(input.custom).slice(0, 30)) {
      const key = clean(k, 40).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (key && !key.startsWith('$')) custom[key] = clean(v, 500);
    }
  }
  let website = clean(input.website, 300);
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`;
  return {
    lead: {
      email,
      name: clean(input.name, 120),
      firstName: clean(input.firstName, 60),
      company: clean(input.company, 160),
      phone: clean(input.phone, 40),
      website,
      city: clean(input.city, 80),
      notes: cleanMultiline(input.notes, 2000),
      firstSubject: clean(input.firstSubject, 200),
      firstMessage: cleanMultiline(input.firstMessage, 20000).trim(),
      custom,
    },
  };
}

module.exports = { isEmail, clean, cleanMultiline, sanitizeLead };
