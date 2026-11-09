// Entry point: node src/index.js
const http = require('http');
const { readConfig, validateConfig, configWarnings, loadDotEnv } = require('./config');
const { createApp } = require('./app');
const { createMailer } = require('./services/mailer');
const { createSender } = require('./services/sender');
const { createImapPoller } = require('./services/imapPoller');

async function main() {
  loadDotEnv();
  const config = readConfig();
  const errors = validateConfig(config);
  if (errors.length) {
    console.error('\nPlease fix these in .env:\n - ' + errors.join('\n - ') + '\n');
    process.exit(1);
  }
  for (const w of configWarnings(config)) console.warn(`[config] ${w}`);

  const { createMongoRepo } = require('./db/mongoRepo');
  const repo = await createMongoRepo({ uri: config.mongoUri, dbName: config.mongoDb });
  await repo.init();
  console.log(`[db] MongoDB connected (${config.mongoDb})`);
  await require('./services/admin').ensureAdminSeeded(repo, config);

  const mailer = createMailer(config);
  const sender = createSender({ repo, mailer, config });
  const imapPoller = createImapPoller({ repo, config });

  const server = http.createServer(createApp({ repo, config, mailer, imapPoller }));
  server.listen(config.port, () => {
    console.log(`[api] Follow Up Software backend: http://localhost:${config.port}`);
    if (config.dryRun) console.log('[mail] MAIL_DRY_RUN=true — emails are only printed to the console, not sent');
  });

  // Every minute: try to send one mail (all rules are checked inside).
  const tick = () => sender.runTick().catch((e) => console.error('[sender]', e));
  setTimeout(tick, 5000);
  const sendTimer = setInterval(tick, 60 * 1000);

  // Every few minutes: read replies over IMAP.
  const poll = () => imapPoller.pollOnce().catch((e) => console.error('[imap]', e));
  if (imapPoller.configured) setTimeout(poll, 10000);
  else console.warn('[imap] IMAP is not configured — replies will not be detected');
  const pollTimer = setInterval(poll, config.imap.pollMinutes * 60 * 1000);

  const shutdown = async () => {
    clearInterval(sendTimer);
    clearInterval(pollTimer);
    server.close();
    await repo.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error('Startup failed:', e.message);
  process.exit(1);
});
