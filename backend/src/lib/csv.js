// Small RFC-4180 style CSV parser + lead column mapping (no dependencies).

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = String(text || '').replace(/^﻿/, '');
  const delimiter = detectDelimiter(s);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function detectDelimiter(s) {
  const firstLine = s.split(/\r?\n/)[0] || '';
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of firstLine) {
    if (ch === '"') q = !q;
    else if (!q && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ',';
}

const ALIASES = {
  email: ['email', 'e-mail', 'email address', 'emailaddress', 'mail', 'email id', 'emailid'],
  name: ['name', 'full name', 'fullname', 'contact', 'contact name', 'contact person', 'owner', 'person'],
  firstName: ['first name', 'firstname', 'first_name', 'fname'],
  lastName: ['last name', 'lastname', 'last_name', 'lname', 'surname'],
  company: ['company', 'company name', 'business', 'business name', 'organization', 'organisation', 'brand', 'firm'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number', 'whatsapp', 'number'],
  website: ['website', 'site', 'url', 'web', 'website url', 'domain'],
  city: ['city', 'location', 'area', 'town'],
  notes: ['notes', 'note', 'comment', 'comments', 'remarks'],
  firstSubject: ['subject', 'first subject', 'email subject', 'subject line', 'first email subject'],
  firstMessage: ['message', 'first message', 'email message', 'email body', 'body', 'pitch', 'first email', 'first email message', 'mail body'],
};

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapHeaders(headers) {
  const map = {};
  headers.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (map[field] === undefined && aliases.map(normalizeHeader).includes(h)) {
        map[field] = idx;
        return;
      }
    }
  });
  return map;
}

/** CSV text -> array of plain lead objects (not validated yet). */
function csvToLeads(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { leads: [], headers: rows[0] || [], error: 'The CSV needs a header row and at least 1 data row' };
  const headers = rows[0].map((h) => String(h).trim());
  const map = mapHeaders(headers);
  if (map.email === undefined) return { leads: [], headers, error: 'No "email" column found in the CSV' };
  const known = new Set(Object.values(map));
  const leads = rows.slice(1).map((r) => {
    const get = (f) => (map[f] !== undefined ? String(r[map[f]] || '').trim() : '');
    let name = get('name');
    const first = get('firstName');
    const last = get('lastName');
    if (!name && (first || last)) name = `${first} ${last}`.trim();
    const custom = {};
    headers.forEach((h, idx) => {
      if (known.has(idx) || !h) return;
      const key = normalizeHeader(h).replace(/\s+/g, '_');
      const val = String(r[idx] || '').trim();
      if (key && val) custom[key] = val.slice(0, 500);
    });
    return {
      email: get('email'),
      name,
      firstName: first,
      company: get('company'),
      phone: get('phone'),
      website: get('website'),
      city: get('city'),
      notes: get('notes'),
      firstSubject: get('firstSubject'),
      firstMessage: map.firstMessage !== undefined ? String(r[map.firstMessage] || '').replace(/\r\n/g, '\n').trim() : '',
      custom,
    };
  });
  return { leads, headers, error: null };
}

module.exports = { parseCsv, csvToLeads, mapHeaders };
