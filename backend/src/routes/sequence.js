const { HttpError } = require('../lib/http');
const { getSequence, validateSteps, getSettings } = require('../services/settings');
const { composeForLead, stepForLead } = require('../services/sender');
const { DEFAULT_STEPS } = require('../defaults');

const SAMPLE_LEAD = {
  name: 'Rahul Sharma',
  email: 'rahul@example.com',
  company: 'Sharma Dental Care',
  city: 'Delhi',
  website: '',
  custom: {},
  unsubToken: 'preview',
  threadSubject: null,
};

function registerSequenceRoutes(router, { repo, config }) {
  router.get('/api/sequence', async () => {
    const [seq, settings] = await Promise.all([getSequence(repo), getSettings(repo, config)]);
    return { steps: seq.steps, updatedAt: seq.updatedAt, senderName: settings.senderName, signature: settings.signature, fromName: settings.fromName };
  });

  router.put('/api/sequence', async ({ body }) => {
    const { steps, error } = validateSteps(body.steps);
    if (error) throw new HttpError(400, error);
    const saved = await repo.saveSequence(steps);
    return { steps: saved.steps, updatedAt: saved.updatedAt };
  });

  // Puts the built-in 6 emails back (overwrites the saved sequence).
  router.post('/api/sequence/reset', async () => {
    const saved = await repo.saveSequence(DEFAULT_STEPS);
    return { steps: saved.steps, updatedAt: saved.updatedAt };
  });

  // Renders one step for a sample (or real) lead so the user sees the final mail.
  router.post('/api/sequence/preview', async ({ body }) => {
    const index = Number(body.index) || 0;
    const { steps } = await getSequence(repo);
    let lead = SAMPLE_LEAD;
    if (body.leadId) lead = (await repo.getLead(String(body.leadId))) || SAMPLE_LEAD;
    const step = body.step || stepForLead(lead, steps, index);
    if (!step) throw new HttpError(400, 'Step not found');
    const settings = await getSettings(repo, config);
    const threadSubject = lead.threadSubject || composeForLead({ lead, step: stepForLead(lead, steps, 0), index: 0, config, settings }).subject;
    const mail = composeForLead({ lead: { ...lead, threadSubject }, step, index, config, settings });
    return { subject: mail.subject, text: mail.text, to: lead.email, from: `${settings.fromName} <${config.fromEmail}>` };
  });
}

module.exports = { registerSequenceRoutes };
