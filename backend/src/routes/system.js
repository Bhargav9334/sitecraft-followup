// Dashboard, settings, global pause, replies, unsubscribed list, connection checks.
const { HttpError } = require('../lib/http');
const { getSettings, validateSettingsPatch, getSequence } = require('../services/settings');
const { sendingState, composeForLead, makeMessageId, unsubscribeInfo, unsubscribeHeaders } = require('../services/sender');
const { hasPublicUrl } = require('../config');
const { canSendNow, nextSendSlot, dayBlockReason } = require('../lib/schedule');
const { zonedParts } = require('../lib/time');
const { isEmail, clean } = require('../lib/validate');

function registerSystemRoutes(router, { repo, config, mailer, imapPoller }) {
  router.get('/api/dashboard', async () => {
    const now = new Date();
    const settings = await getSettings(repo, config);
    const state = await sendingState(repo, config, settings, now);
    const [counts, totalSent, todayLogs, upcoming, replies, { steps }] = await Promise.all([
      repo.countLeadsByStatus(),
      repo.countSent(),
      repo.sentBetween(state.dayStart, state.dayEnd),
      repo.upcomingLeads(10),
      repo.listInbound({ kind: 'reply', page: 1, limit: 5 }),
      getSequence(repo),
    ]);
    const leadCache = new Map();
    const leadOf = async (id) => {
      if (!leadCache.has(id)) leadCache.set(id, await repo.getLead(id));
      return leadCache.get(id);
    };
    const todaySent = [];
    for (const l of todayLogs) {
      const lead = await leadOf(l.leadId);
      todaySent.push({ at: l.at, step: l.step, subject: l.subject, leadId: l.leadId, name: lead?.name || '', company: lead?.company || '', email: lead?.email || '' });
    }
    const recentReplies = [];
    for (const r of replies.items) {
      const lead = await leadOf(r.leadId);
      recentReplies.push({ at: r.at, text: (r.text || '').slice(0, 200), leadId: r.leadId, name: lead?.name || r.fromName || '', company: lead?.company || '', email: lead?.email || r.fromEmail, afterStep: lead?.repliedAfterStep ?? null });
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const p = zonedParts(now, config.timezone);
    return {
      now,
      today: p.dateKey,
      timezone: config.timezone,
      counts: { total, ...counts },
      sentToday: state.sentToday,
      totalSent,
      settings,
      sendStatus: canSendNow(now, settings, state),
      dayBlocked: dayBlockReason(now, settings),
      nextSlot: nextSendSlot(now, settings, state),
      todaySent,
      upcoming: upcoming.map((l) => ({ id: l.id, name: l.name, company: l.company, email: l.email, status: l.status, nextStep: (l.step || 0) + 1, nextSendAt: l.nextSendAt })),
      recentReplies,
      totalSteps: steps.length,
      imap: { configured: imapPoller.configured, last: (await repo.getSettings())?.lastImapPoll || null },
      dryRun: Boolean(mailer.dryRun),
    };
  });

  router.get('/api/settings', async () => getSettings(repo, config));

  router.put('/api/settings', async ({ body }) => {
    const { patch, error } = validateSettingsPatch(body, config);
    if (error) throw new HttpError(400, error);
    const merged = { ...(await getSettings(repo, config)), ...patch };
    if (merged.startHour >= merged.endHour) throw new HttpError(400, 'Start time must be before stop time');
    await repo.saveSettings(patch);
    return getSettings(repo, config);
  });

  router.post('/api/system/pause', async () => {
    await repo.saveSettings({ paused: true, pausedAt: new Date() });
    return getSettings(repo, config);
  });

  router.post('/api/system/resume', async () => {
    await repo.saveSettings({ paused: false, pausedAt: null });
    return getSettings(repo, config);
  });

  router.get('/api/system/status', async () => ({
    smtp: await mailer.verify(),
    smtpHost: config.mailTransport === 'gmail-api' ? 'Gmail API (HTTPS)' : config.smtp.host,
    mailTransport: config.mailTransport,
    imapHost: config.imap.host,
    imap: { configured: imapPoller.configured, last: (await repo.getSettings())?.lastImapPoll || null, pollMinutes: config.imap.pollMinutes },
    fromEmail: config.fromEmail,
    fromName: (await getSettings(repo, config)).fromName,
    dryRun: Boolean(mailer.dryRun),
    publicBackendUrl: config.publicBackendUrl,
    unsubscribeMode: hasPublicUrl(config) ? 'link' : 'reply',
  }));

  router.post('/api/system/check-replies', async () => imapPoller.pollOnce());

  // Sends Mail 1 (with sample data) to your own inbox — does not count in the daily limit.
  router.post('/api/system/test-email', async ({ body }) => {
    const to = String(body.to || config.fromEmail).trim().toLowerCase();
    if (!isEmail(to)) throw new HttpError(400, 'Invalid email address');
    const index = Math.min(5, Math.max(0, Number(body.index) || 0));
    const [{ steps }, settings] = await Promise.all([getSequence(repo), getSettings(repo, config)]);
    // A one-off email exactly as a lead would receive it. No lead is created,
    // so no follow-ups are ever sent to this address.
    const lead = { name: clean(body.name, 120), email: to, company: clean(body.company, 160), city: '', custom: {}, unsubToken: 'test-preview', threadSubject: null };
    const first = composeForLead({ lead, step: steps[0], index: 0, config, settings });
    lead.threadSubject = first.subject;
    const mail = index === 0 ? first : composeForLead({ lead, step: steps[index], index, config, settings });
    try {
      await mailer.send({
        fromName: settings.fromName,
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        messageId: makeMessageId(config.fromEmail),
        headers: unsubscribeHeaders(unsubscribeInfo(config, lead)),
      });
    } catch (e) {
      throw new HttpError(502, `Email could not be sent: ${e.message}`);
    }
    return { ok: true, to };
  });

  router.get('/api/replies', async ({ query }) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const { items, total } = await repo.listInbound({ kind: 'reply', page, limit: 50 });
    const out = [];
    for (const r of items) {
      const lead = await repo.getLead(r.leadId);
      out.push({ id: r.id, at: r.at, subject: r.subject, text: r.text, fromEmail: r.fromEmail, leadId: r.leadId, name: lead?.name || r.fromName || '', company: lead?.company || '', email: lead?.email || r.fromEmail, phone: lead?.phone || '', step: lead?.step || 0, repliedAfterStep: lead?.repliedAfterStep ?? null, status: lead?.status || 'deleted' });
    }
    return { items: out, total, page };
  });

  router.get('/api/unsubscribed', async ({ query }) => {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const { items, total } = await repo.listLeads({ status: 'unsubscribed', page, limit: 100 });
    return {
      items: items.map((l) => ({ id: l.id, name: l.name, company: l.company, email: l.email, step: l.step, unsubscribedAt: l.unsubscribedAt })),
      total,
      page,
    };
  });
}

module.exports = { registerSystemRoutes };
