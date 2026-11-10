// Decides what an incoming email means: a real reply (stop the sequence),
// an auto-reply / out-of-office (ignore), or a bounce (stop + mark bounced).

const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery (subsystem|system))/i;
const AUTO_SUBJECT = /(out of (the )?office|automatic reply|auto[- ]?reply|autoreply|on leave|vacation reply|abwesenheit)/i;
const EMAIL_IN_TEXT = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const UNSUB_SUBJECT = /^\s*(re:\s*)?(unsubscribe|opt[- ]?out)\b/i;
const UNSUB_WORDS = /^(please\s+)?(unsubscribe(\s+me)?|opt[- ]?out|stop|stop emailing( me)?|remove me( from (your|the) list)?|remove|no|no,? thanks?( you)?|not interested)\s*(please)?[.!]*$/i;

/** Only the lead's own words — drops the quoted earlier mail ("> ..." and "On ... wrote:"). */
function ownText(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^\s*From:\s/i.test(line)) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

/** "unsubscribe" as the subject, or a short reply that is only "unsubscribe" / "stop" / "remove me". */
function isUnsubscribeRequest(msg) {
  if (UNSUB_SUBJECT.test(msg.subject || '')) return true;
  const own = ownText(msg.text);
  const firstLine = own.split(/\n/).map((l) => l.trim()).find(Boolean) || '';
  if (own.length <= 120 && UNSUB_WORDS.test(firstLine)) return true;
  return false;
}

function isAutoReply(msg) {
  const h = msg.headers || {};
  const autoSubmitted = String(h['auto-submitted'] || '').toLowerCase();
  if (autoSubmitted && autoSubmitted !== 'no') return true;
  if (h['x-autoreply'] || h['x-autorespond']) return true;
  const prec = String(h['precedence'] || '').toLowerCase();
  if (['auto_reply', 'bulk', 'junk'].includes(prec)) return true;
  return AUTO_SUBJECT.test(msg.subject || '');
}

/**
 * msg = { messageId, from, fromName, subject, text, date, inReplyTo, references[], headers{} }
 */
async function handleIncoming({ repo, msg, now = new Date() }) {
  if (msg.messageId && (await repo.logExistsByMessageId(msg.messageId))) return { action: 'duplicate' };
  const at = msg.date ? new Date(msg.date) : now;
  const threadIds = [msg.inReplyTo, ...(msg.references || [])].filter(Boolean);
  const snippet = String(msg.text || '').slice(0, 5000);

  // ---- bounce ----
  if (BOUNCE_FROM.test(msg.from || '') || BOUNCE_FROM.test(msg.fromName || '')) {
    let lead = threadIds.length ? await repo.getLeadByMessageIds(threadIds) : null;
    if (!lead) {
      const candidates = [...new Set((snippet.match(EMAIL_IN_TEXT) || []).map((e) => e.toLowerCase()))];
      for (const email of candidates) {
        lead = await repo.getLeadByEmail(email);
        if (lead) break;
      }
    }
    if (!lead) return { action: 'ignored' };
    await repo.addLog({ leadId: lead.id, direction: 'in', kind: 'bounce', subject: msg.subject || '', messageId: msg.messageId, fromEmail: msg.from, text: snippet, at });
    if (['queued', 'active', 'completed'].includes(lead.status)) {
      await repo.updateLead(lead.id, { status: 'bounced', nextSendAt: null, bouncedAt: at });
    }
    return { action: 'bounced', leadId: lead.id };
  }

  // ---- find the lead ----
  let lead = threadIds.length ? await repo.getLeadByMessageIds(threadIds) : null;
  if (!lead && msg.from) lead = await repo.getLeadByEmail(msg.from);
  if (!lead) return { action: 'ignored' };

  // ---- "unsubscribe" reply (works without a public domain) ----
  if (isUnsubscribeRequest(msg)) {
    await repo.addLog({ leadId: lead.id, direction: 'in', kind: 'unsubscribe', subject: msg.subject || '', messageId: msg.messageId, fromEmail: msg.from, fromName: msg.fromName || '', text: snippet, at });
    if (lead.status !== 'unsubscribed') {
      await repo.updateLead(lead.id, { status: 'unsubscribed', nextSendAt: null, unsubscribedAt: at, statusBeforeUnsub: lead.status, unsubscribedVia: 'reply' });
    }
    return { action: 'unsubscribed', leadId: lead.id };
  }

  // ---- out of office / auto reply: keep sequence running ----
  if (isAutoReply(msg)) {
    await repo.addLog({ leadId: lead.id, direction: 'in', kind: 'auto', subject: msg.subject || '', messageId: msg.messageId, fromEmail: msg.from, text: snippet, at });
    return { action: 'auto-reply', leadId: lead.id };
  }

  // ---- real reply: stop follow-ups ----
  await repo.addLog({ leadId: lead.id, direction: 'in', kind: 'reply', subject: msg.subject || '', messageId: msg.messageId, fromEmail: msg.from, fromName: msg.fromName || '', text: snippet, at });
  const patch = { replyCount: (lead.replyCount || 0) + 1, lastReplyAt: at, lastReplySnippet: snippet.slice(0, 300) };
  if (['queued', 'active', 'completed', 'stopped', 'bounced'].includes(lead.status)) {
    Object.assign(patch, { status: 'replied', nextSendAt: null, repliedAt: lead.repliedAt || at, repliedAfterStep: lead.step || 0 });
  }
  await repo.updateLead(lead.id, patch);
  return { action: 'replied', leadId: lead.id };
}

module.exports = { handleIncoming, isAutoReply, isUnsubscribeRequest, ownText };
