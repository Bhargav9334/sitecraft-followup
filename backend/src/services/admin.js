// Admin login stored in MongoDB (password hashed with scrypt).
// The first admin is seeded from ADMIN_USERNAME / ADMIN_PASSWORD in .env.
const { hashPassword, verifyPassword } = require('../lib/auth');

/** Creates the admin from .env if the database has none yet. */
async function ensureAdminSeeded(repo, config, logger = console) {
  if ((await repo.countAdmins()) > 0) return { seeded: false };
  await repo.upsertAdmin({ username: config.adminUsername, passwordHash: hashPassword(config.adminPassword) });
  logger.log(`[auth] Admin "${config.adminUsername}" saved to the database (seed)`);
  return { seeded: true };
}

/** Creates or resets an admin (used by `npm run seed`). */
async function setAdmin(repo, username, password) {
  if (!username || !password || password.length < 8) throw new Error('A username and a password of at least 8 characters are required');
  return repo.upsertAdmin({ username: String(username).trim(), passwordHash: hashPassword(password) });
}

async function checkLogin(repo, username, password) {
  const admin = await repo.getAdmin(String(username || '').trim());
  // run a hash even when the user does not exist, so timing doesn't reveal valid usernames
  const ok = verifyPassword(password, admin ? admin.passwordHash : 'scrypt$00$' + '00'.repeat(64));
  return ok && admin ? admin : null;
}

module.exports = { ensureAdminSeeded, setAdmin, checkLogin };
