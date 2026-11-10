// The automatic sender. runTick() is called every minute and sends AT MOST one
// mail, only when every rule allows it (window, gap, daily limit, Sunday,
// holiday, global pause).
const crypto = require('crypto');
const { dayBounds, addMinutes } = require('../lib/time');
const { canSendNow, followUpDueAt } = require('../lib/schedule');
const { buildEmail } = require('../lib/template');
const { getSettings, getSequence } = require('./settings');
const { useUnsubscribeLink } = require('../config');

const MAX_FAILS = 3;

function makeMessageId(fromEmail) {
  const domain = String(fromEmail).split('@')[1] || 'localhost';
  return `<${crypto.randomBytes(12).toString('hex')}@${domain}>`;
}

/**
 * How a lead unsubscribes.
 * - With a public PUBLIC_BACKEND_URL: a one-click link + a reply option.
 * - Without one (localhost / no domain): the lead replies "unsubscribe" and the
 *   inbox checker moves them to the Unsubscribed list automatically.
 */
function unsubscribeInfo(config, lead) {
  const mailto = `mailto:${config.fromEmail}?subject=${encodeURIComponent('Unsubscribe')}`;
  const url = useUnsubscribeLink(config) ? `${config.publicBackendUrl}/u/${lead.unsubToken}` : null;
  return { url, mailto };
}

function unsubscribeHeaders(info) {
  if (info.url) return { 'List-Unsubscribe': `<${info.url}>, <${info.mailto}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
  return { 'List-Unsubscribe': `<${info.mailto}>` };
}

/**
 * The step to send. Email 1 comes from the lead's own CSV row (subject + message)
 * when it has one; otherwise the default Email 1 from the Sequence page is used.
 * Follow-ups (emails 2–6) always come from the Sequence page.
 */
function stepForLead(lead, steps, index) {
  if (index === 0 && lead.firstMessage && String(lead.firstMessage).trim()) {
    return { subject: lead.firstSubject || steps[0].subject, body: lead.firstMessage };
  }
  return steps[index];
}

/** Builds the mail for a lead + step without sending it (signature + sender name come from Settings). */
function composeForLead({ lead, step, index, config, settings }) {
  return buildEmail({
    step,
    index,
    lead,
    unsubscribe: unsubscribeInfo(config, lead),
    senderName: settings.senderName,
    signature: settings.signature,
  });
}

async function sendingState(repo, config, settings, now) {
  const { start, end } = dayBounds(now, config.timezone);
  const [sentToday, last] = await Promise.all([repo.countSent(start, end), repo.lastSent()]);
  return { sentToday, lastSentAt: last ? last.at : null, dayStart: start, dayEnd: end, settings };
}

function createSender({ repo, mailer, config, logger = console }) {
  let running = false;

  async function runTick(now = new Date()) {
    if (running) return { sent: false, reason: 'Previous run is still in progress' };
    running = true;
    try {
      const settings = await getSettings(repo, config);
      const state = await sendingState(repo, config, settings, now);
      const check = canSendNow(now, settings, state);
      if (!check.ok) return { sent: false, reason: check.reason };

      const lead = await repo.findNextDueLead(now);
      if (!lead) return { sent: false, reason: 'No lead is due right now' };

      const { steps } = await getSequence(repo);
      const index = lead.step || 0;
      if (index >= steps.length) {
        await repo.updateLead(lead.id, { status: 'completed', nextSendAt: null, completedAt: now });
        return { sent: false, reason: 'Sequence already finished for this lead' };
      }

      const mail = composeForLead({ lead, step: stepForLead(lead, steps, index), index, config, settings });
      const messageId = makeMessageId(config.fromEmail);
      const refs = lead.messageIds || [];

      let info;
      try {
        info = await mailer.send({
          fromName: settings.fromName,
          to: lead.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          messageId,
          inReplyTo: refs.length ? refs[refs.length - 1] : undefined,
          references: refs.length ? refs : undefined,
          headers: unsubscribeHeaders(unsubscribeInfo(config, lead)),
          threadId: lead.gmailThreadId || undefined,
        });
      } catch (err) {
        const fails = (lead.failCount || 0) + 1;
        await repo.addLog({ leadId: lead.id, direction: 'out', kind: 'sequence', step: index + 1, subject: mail.subject, at: now, status: 'failed', error: String(err.message || err).slice(0, 500) });
        const patch = { failCount: fails, lastError: String(err.message || err).slice(0, 500) };
        if (fails >= MAX_FAILS) Object.assign(patch, { status: 'stopped', nextSendAt: null, stoppedAt: now, stopReason: `Sending failed ${MAX_FAILS} times` });
        else patch.nextSendAt = addMinutes(now, 30);
        await repo.updateLead(lead.id, patch);
        logger.error(`[sender] failed to send to ${lead.email}: ${err.message || err}`);
        return { sent: false, reason: `Send failed: ${err.message || err}`, leadId: lead.id };
      }

      // Gmail API may give the mail its own Message-ID: keep both so replies always match.
      const sentId = (info && info.messageId) || messageId;
      const newIds = [...new Set([messageId, sentId].filter(Boolean))];
      await repo.addLog({ leadId: lead.id, direction: 'out', kind: 'sequence', step: index + 1, subject: mail.subject, messageId: sentId, text: mail.text, at: now, status: 'sent' });
      if (config.warmup && !settings.warmupStartedAt) await repo.saveSettings({ warmupStartedAt: now });
      const nextIndex = index + 1;
      const patch = {
        step: nextIndex,
        lastSentAt: now,
        messageIds: [...refs, ...newIds],
        ...(info && info.threadId ? { gmailThreadId: info.threadId } : {}),
        threadSubject: lead.threadSubject || mail.subject,
        failCount: 0,
        lastError: null,
      };
      if (nextIndex >= steps.length) Object.assign(patch, { status: 'completed', nextSendAt: null, completedAt: now });
      else Object.assign(patch, { status: 'active', nextSendAt: followUpDueAt(now, steps[nextIndex].delayDays) });
      await repo.updateLead(lead.id, patch);
      logger.log(`[sender] Mail ${nextIndex} sent to ${lead.email}`);
      return { sent: true, leadId: lead.id, step: nextIndex, messageId: sentId };
    } finally {
      running = false;
    }
  }

  return { runTick };
}

module.exports = { createSender, composeForLead, stepForLead, sendingState, makeMessageId, unsubscribeInfo, unsubscribeHeaders };
