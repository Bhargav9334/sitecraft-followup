const { signToken, createLoginLimiter } = require('../lib/auth');
const { checkLogin } = require('../services/admin');
const { HttpError } = require('../lib/http');

function registerAuthRoutes(router, { config, repo }) {
  const limiter = createLoginLimiter({ maxAttempts: 5, windowMs: 15 * 60 * 1000 });

  router.post('/api/auth/login', async ({ body, ip }) => {
    const blockedMinutes = limiter.isBlocked(ip);
    if (blockedMinutes) throw new HttpError(429, `Too many failed attempts. Try again in ${blockedMinutes} minutes.`);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const admin = await checkLogin(repo, username, password);
    if (!admin) {
      limiter.fail(ip);
      throw new HttpError(401, 'Incorrect username or password');
    }
    limiter.reset(ip);
    const name = admin.displayName || admin.username;
    const token = signToken({ sub: name }, config.authSecret, config.sessionHours * 3600);
    return { token, username: name, expiresInHours: config.sessionHours };
  }, { public: true });

  router.get('/api/auth/me', async ({ user }) => ({ username: user.sub }));
}

module.exports = { registerAuthRoutes };
