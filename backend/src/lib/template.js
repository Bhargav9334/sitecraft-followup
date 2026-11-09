// Turns a sequence step + lead into the real email (subject, text, html).

const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g;

const HONORIFICS = /^(dr|mr|mrs|ms|miss|shri|smt|sri|prof|er|adv|ca)\.?$/i;

/** "Dr. Ravi Sharma" -> "Ravi" */
function firstNameOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const real = parts.find((p) => !HONORIFICS.test(p));
  return real || '';
}

function leadVars(lead, extra = {}) {
  const firstName = lead.firstName || firstNameOf(lead.name);
  return {
    ...(lead.custom || {}),
    name: lead.name || '',
    first_name: firstName || '',
    email: lead.email || '',
    company: lead.company || '',
    phone: lead.phone || '',
    website: lead.website || '',
    city: lead.city || '',
    ...extra,
  };
}

/** {{company}} or {{first_name|there}} (value after | is the fallback). */
function render(str, vars) {
  return String(str || '').replace(VAR_RE, (_, key, fallback) => {
    const v = vars[key.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    return fallback !== undefined ? fallback.trim() : '';
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(text) {
  const linked = escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return linked
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px 0">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Builds the final mail for a lead.
 * step = { subject, body }, index = 0-based step number
 */
function signatureLines(signature) {
  if (!signature) return [];
  return [signature.closing, signature.name, signature.phone].map((s) => String(s || '').trim()).filter(Boolean);
}

/**
 * unsubscribe = { url, mailto } — url is null when there is no public domain;
 * then the lead unsubscribes by replying "unsubscribe" (detected automatically).
 * (A plain unsubscribeUrl string is still accepted.)
 */
function buildEmail({ step, index, lead, unsubscribe, unsubscribeUrl, senderName, signature }) {
  const unsub = unsubscribe || { url: unsubscribeUrl || null, mailto: null };
  const vars = leadVars(lead, { sender_name: senderName || '' });
  let subject = render(step.subject, vars).trim();
  // Follow-ups with an empty subject reply in the same thread.
  if (!subject && index > 0 && lead.threadSubject) subject = `Re: ${lead.threadSubject.replace(/^re:\s*/i, '')}`;
  if (!subject) subject = 'Hello';
  const body = render(step.body, vars).trim();
  const sig = signatureLines(signature);
  const lead_in = "If you don't want to receive more emails from me";
  const footerText = unsub.url
    ? `\n\n--\n${lead_in}, unsubscribe here: ${unsub.url}`
    : `\n\n--\n${lead_in}, just reply with "unsubscribe" and I won't email you again.`;
  const footerHtml = unsub.url
    ? `${lead_in}, <a href="${escapeHtml(unsub.url)}" style="color:#8a93a3">unsubscribe here</a>.`
    : unsub.mailto
      ? `${lead_in}, just reply with <a href="${escapeHtml(unsub.mailto)}" style="color:#8a93a3">&quot;unsubscribe&quot;</a> and I won't email you again.`
      : `${lead_in}, just reply with &quot;unsubscribe&quot; and I won't email you again.`;
  const text = body + (sig.length ? `\n\n${sig.join('\n')}` : '') + footerText;
  const sigHtml = sig.length ? `<p style="margin:0 0 14px 0">${sig.map(escapeHtml).join('<br>')}</p>` : '';
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1f2430">${textToHtml(body)}${sigHtml}` +
    `<p style="margin:24px 0 0 0;font-size:12px;color:#8a93a3">${footerHtml}</p></div>`;
  return { subject, text, html };
}

module.exports = { render, leadVars, buildEmail, escapeHtml, signatureLines };
