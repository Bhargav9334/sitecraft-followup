const { HttpError } = require('../lib/http');
const { STATUSES } = require('../db/leadQuery');
const { addLeads, importCsv, stopLead, resumeLead } = require('../services/leads');
const { getSequence } = require('../services/settings');
const { sanitizeLead } = require('../lib/validate');

const EDITABLE = ['name', 'firstName', 'company', 'phone', 'website', 'city', 'notes', 'custom', 'firstSubject', 'firstMessage'];

function publicLead(l) {
  if (!l) return l;
  const { unsubToken, messageIds, ...rest } = l;
  return rest;
}

function registerLeadRoutes(router, { repo }) {
  async function mustGetLead(id) {
    const lead = await repo.getLead(id);
    if (!lead) throw new HttpError(404, 'Lead not found');
    return lead;
  }

  router.get('/api/leads', async ({ query }) => {
    const status = STATUSES.includes(query.status) ? query.status : undefined;
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
    const q = String(query.q || '').trim().slice(0, 100) || undefined;
    const [{ items, total }, counts] = await Promise.all([repo.listLeads({ status, q, page, limit }), repo.countLeadsByStatus()]);
    return { items: items.map(publicLead), total, page, limit, counts };
  });

  router.post('/api/leads', async ({ body }) => {
    const res = await addLeads(repo, [body], 'manual');
    if (res.invalid) throw new HttpError(400, res.invalidSamples[0]);
    if (res.duplicates) throw new HttpError(409, 'This email is already in your list');
    return { lead: publicLead(res.leads[0]) };
  });

  router.post('/api/leads/import', async ({ body }) => {
    if (typeof body.csv !== 'string' || !body.csv.trim()) throw new HttpError(400, 'The CSV file is empty');
    const res = await importCsv(repo, body.csv);
    if (res.error) throw new HttpError(400, res.error);
    const { leads, ...summary } = res;
    return summary;
  });

  router.post('/api/leads/bulk', async ({ body }) => {
    const ids = Array.isArray(body.ids) ? body.ids.slice(0, 500).map(String) : [];
    const action = body.action;
    if (!ids.length) throw new HttpError(400, 'No leads selected');
    if (!['stop', 'resume', 'delete'].includes(action)) throw new HttpError(400, 'Invalid action');
    const { steps } = await getSequence(repo);
    let done = 0;
    const errors = [];
    for (const id of ids) {
      const lead = await repo.getLead(id);
      if (!lead) continue;
      if (action === 'delete') {
        if (await repo.deleteLead(id)) done++;
        continue;
      }
      const r = action === 'stop' ? await stopLead(repo, lead) : await resumeLead(repo, lead, steps.length);
      if (r.error) errors.push(`${lead.email}: ${r.error}`);
      else done++;
    }
    return { done, skipped: errors.length, errors: errors.slice(0, 10) };
  });

  router.get('/api/leads/:id', async ({ params }) => {
    const lead = await mustGetLead(params.id);
    const [logs, { steps }] = await Promise.all([repo.listLogsForLead(lead.id), getSequence(repo)]);
    return {
      lead: publicLead(lead),
      totalSteps: steps.length,
      logs: logs.map((l) => ({ id: l.id, direction: l.direction, kind: l.kind, step: l.step, subject: l.subject, text: l.text, at: l.at, status: l.status, error: l.error, fromEmail: l.fromEmail })),
    };
  });

  router.patch('/api/leads/:id', async ({ params, body }) => {
    const lead = await mustGetLead(params.id);
    const merged = { ...lead, ...Object.fromEntries(EDITABLE.filter((k) => body[k] !== undefined).map((k) => [k, body[k]])) };
    const { lead: clean, error } = sanitizeLead(merged);
    if (error) throw new HttpError(400, error);
    const patch = Object.fromEntries(EDITABLE.map((k) => [k, clean[k]]));
    return { lead: publicLead(await repo.updateLead(lead.id, patch)) };
  });

  router.post('/api/leads/:id/stop', async ({ params }) => {
    const r = await stopLead(repo, await mustGetLead(params.id));
    if (r.error) throw new HttpError(400, r.error);
    return { lead: publicLead(r.lead) };
  });

  router.post('/api/leads/:id/resume', async ({ params }) => {
    const { steps } = await getSequence(repo);
    const r = await resumeLead(repo, await mustGetLead(params.id), steps.length);
    if (r.error) throw new HttpError(400, r.error);
    return { lead: publicLead(r.lead) };
  });

  router.delete('/api/leads/:id', async ({ params }) => {
    await mustGetLead(params.id);
    await repo.deleteLead(params.id);
    return { ok: true };
  });
}

module.exports = { registerLeadRoutes, publicLead };
