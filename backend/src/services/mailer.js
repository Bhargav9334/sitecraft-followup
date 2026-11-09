// Sending: SMTP (nodemailer) or the Gmail API over HTTPS (MAIL_TRANSPORT=gmail-api,
// for hosts that block SMTP ports). With MAIL_DRY_RUN=true nothing is really
// sent — the mail is only printed in the console (useful for testing).

function createMailer(config, logger = console, deps = {}) {
  const fromHeader = (name) => {
    const n = String(name || config.fromName || '').replace(/["\r\n<>]/g, '').trim();
    return n ? `"${n}" <${config.fromEmail}>` : config.fromEmail;
  };

  if (config.dryRun) {
    return {
      dryRun: true,
      async verify() {
        return { ok: true, message: 'Dry-run mode: emails are printed to the console, not sent' };
      },
      async send(mail) {
        logger.log(`[dry-run] From: ${fromHeader(mail.fromName)} | To: ${mail.to} | Subject: ${mail.subject}`);
        return { messageId: mail.messageId };
      },
    };
  }

  const mailOptions = (mail) => ({
    from: fromHeader(mail.fromName),
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    messageId: mail.messageId,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    headers: mail.headers,
  });

  if (config.mailTransport === 'gmail-api') {
    const { createGmailApiClient, buildRaw } = require('./gmailApi');
    const gmail = createGmailApiClient(config.gmailApi, deps.fetch);
    return {
      dryRun: false,
      transport: 'gmail-api',
      async verify() {
        try {
          const p = await gmail.profile();
          if (config.fromEmail && String(p.emailAddress).toLowerCase() !== config.fromEmail.toLowerCase())
            return { ok: false, message: `Gmail API is connected to ${p.emailAddress}, but FROM_EMAIL is ${config.fromEmail} — run "npm run gmail-auth" with the right account` };
          return { ok: true, message: `Gmail API connected (${p.emailAddress})` };
        } catch (e) {
          return { ok: false, message: e.message };
        }
      },
      async send(mail) {
        const raw = await (deps.buildRaw || buildRaw)(mailOptions(mail));
        const r = await gmail.sendRaw(raw, mail.threadId);
        return { messageId: r.messageId || mail.messageId, threadId: r.threadId, gmailId: r.id };
      },
    };
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  return {
    dryRun: false,
    transport: 'smtp',
    async verify() {
      try {
        await transporter.verify();
        return { ok: true, message: `SMTP connected (${config.smtp.host})` };
      } catch (e) {
        return { ok: false, message: e.message };
      }
    },
    async send(mail) {
      const info = await transporter.sendMail(mailOptions(mail));
      return { messageId: info.messageId || mail.messageId };
    },
  };
}

module.exports = { createMailer };
