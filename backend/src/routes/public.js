// Public pages: unsubscribe link from emails + health check. No login needed.
const { sendHtml } = require('../lib/http');
const { escapeHtml } = require('../lib/template');
const { unsubscribeLead } = require('../services/leads');
const { LOGO_SVG } = require('../lib/brand');

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#0e1525">
<div style="max-width:440px;margin:64px auto 0;padding:0 16px"><div style="margin-bottom:20px">${LOGO_SVG}</div>
<div style="background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:32px">${inner}</div></div></body></html>`;
}

function registerPublicRoutes(router, { repo }) {
  router.get('/health', async () => ({ ok: true }), { public: true });

  router.get('/u/:token', async ({ params, res }) => {
    if (params.token === 'test-preview') return sendHtml(res, 200, page('Test email', '<h2 style="margin:0 0 8px">This was a test email</h2><p style="color:#5b6474;line-height:1.5">In real emails, this link unsubscribes the person instantly and they never receive another email.</p>'));
    const lead = await repo.getLeadByUnsubToken(params.token);
    if (!lead) return sendHtml(res, 404, page('Link not valid', '<h2 style="margin:0 0 8px">Link not valid</h2><p style="color:#5b6474">This unsubscribe link is not valid or has expired.</p>'));
    if (lead.status === 'unsubscribed') return sendHtml(res, 200, page('Unsubscribed', `<h2 style="margin:0 0 8px">You're unsubscribed</h2><p style="color:#5b6474">${escapeHtml(lead.email)} will not receive any more emails from us.</p>`));
    return sendHtml(
      res,
      200,
      page(
        'Unsubscribe',
        `<h2 style="margin:0 0 8px">Unsubscribe?</h2><p style="color:#5b6474;line-height:1.5">Click the button below and <b>${escapeHtml(lead.email)}</b> will not receive any more emails from us.</p>
<form method="post" action=""><button type="submit" style="margin-top:12px;background:#3d5afe;color:#fff;border:0;border-radius:8px;padding:12px 20px;font-size:15px;cursor:pointer">Unsubscribe</button></form>`
      )
    );
  }, { public: true });

  // Handles both the button above and one-click unsubscribe from Gmail (RFC 8058).
  router.post('/u/:token', async ({ params, res }) => {
    if (params.token === 'test-preview') return sendHtml(res, 200, page('Test email', '<h2 style="margin:0">This was a test email</h2>'));
    const lead = await repo.getLeadByUnsubToken(params.token);
    if (!lead) return sendHtml(res, 404, page('Link not valid', '<h2 style="margin:0">Link not valid</h2>'));
    await unsubscribeLead(repo, lead);
    return sendHtml(res, 200, page('Unsubscribed', `<h2 style="margin:0 0 8px">You're unsubscribed</h2><p style="color:#5b6474">${escapeHtml(lead.email)} will not receive any more emails from us. Sorry for the bother.</p>`));
  }, { public: true });
}

module.exports = { registerPublicRoutes };
