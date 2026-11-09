// Lead creation and manual actions (stop / resume).
const { sanitizeLead } = require('../lib/validate');
const { randomToken } = require('../lib/auth');
const { csvToLeads } = require('../lib/csv');

const MAX_IMPORT = 5000;

function newLeadDoc(clean, source, now) {
  return {
    ...clean,
    status: 'queued',
    step: 0,
    nextSendAt: now,
    lastSentAt: null,
    messageIds: [],
    threadSubject: null,
    unsubToken: randomToken(24),
    replyCount: 0,
    failCount: 0,
    source,
    createdAt: now,
    updatedAt: now,
  };
}

async function addLeads(repo, rawList, source, now = new Date()) {
  const invalid = [];
  const seen = new Set();
  const docs = [];
  for (const raw of rawList.slice(0, MAX_IMPORT)) {
    const { lead, error } = sanitizeLead(raw || {});
    if (error) {
      invalid.push(error);
      continue;
    }
    if (seen.has(lead.email)) continue;
    seen.add(lead.email);
    // tiny offset keeps the upload order inside the queue
    docs.push(newLeadDoc(lead, source, new Date(now.getTime() + docs.length)));
  }
  const { inserted, duplicates } = await repo.insertLeads(docs);
  return {
    added: inserted.length,
    withOwnFirstEmail: inserted.filter((l) => l.firstMessage).length,
    duplicates: duplicates.length,
    invalid: invalid.length,
    invalidSamples: invalid.slice(0, 5),
    skippedOverLimit: Math.max(0, rawList.length - MAX_IMPORT),
    leads: inserted,
  };
}

async function importCsv(repo, csvText, now = new Date()) {
  const { leads, error } = csvToLeads(csvText);
  if (error) return { error };
  return addLeads(repo, leads, 'csv', now);
}

async function stopLead(repo, lead, now = new Date()) {
  if (!['queued', 'active'].includes(lead.status)) return { error: `This lead is already "${lead.status}"` };
  return { lead: await repo.updateLead(lead.id, { status: 'stopped', nextSendAt: null, stoppedAt: now, stopReason: 'Manually stopped' }) };
}

async function resumeLead(repo, lead, totalSteps, now = new Date()) {
  if (lead.status === 'unsubscribed') return { error: 'Unsubscribed leads can never be emailed again' };
  if (lead.status === 'bounced') return { error: 'Email to this address bounced' };
  if (['queued', 'active'].includes(lead.status)) return { error: 'This lead is already in the sequence' };
  if ((lead.step || 0) >= totalSteps) return { error: 'All emails have already been sent to this lead' };
  const status = (lead.step || 0) > 0 ? 'active' : 'queued';
  return { lead: await repo.updateLead(lead.id, { status, nextSendAt: now, stoppedAt: null, stopReason: null, failCount: 0 }) };
}

async function unsubscribeLead(repo, lead, now = new Date()) {
  if (lead.status === 'unsubscribed') return lead;
  return repo.updateLead(lead.id, { status: 'unsubscribed', nextSendAt: null, unsubscribedAt: now, statusBeforeUnsub: lead.status });
}

module.exports = { addLeads, importCsv, stopLead, resumeLead, unsubscribeLead };
