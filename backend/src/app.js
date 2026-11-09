// Wires the HTTP server: security, CORS, auth guard, routes, error handling.
const { createRouter, readBody, parseBody, sendJson, setSecurityHeaders, applyCors, HttpError } = require('./lib/http');
const { verifyToken } = require('./lib/auth');
const { registerAuthRoutes } = require('./routes/auth');
const { registerLeadRoutes } = require('./routes/leads');
const { registerSequenceRoutes } = require('./routes/sequence');
const { registerSystemRoutes } = require('./routes/system');
const { registerPublicRoutes } = require('./routes/public');

const BODY_LIMIT = 6 * 1024 * 1024; // 6 MB (CSV uploads)

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || 'unknown';
}

function createApp(deps) {
  const { config, logger = console } = deps;
  const router = createRouter();
  registerPublicRoutes(router, deps);
  registerAuthRoutes(router, deps);
  registerLeadRoutes(router, deps);
  registerSequenceRoutes(router, deps);
  registerSystemRoutes(router, deps);

  return async function handler(req, res) {
    setSecurityHeaders(res);
    applyCors(req, res, config.frontendUrls);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    try {
      const url = new URL(req.url, 'http://localhost');
      const found = router.match(req.method, url.pathname);
      if (!found) throw new HttpError(404, 'Not found');
      if (found.methodNotAllowed) throw new HttpError(405, 'Method not allowed');
      const [fn, opts = {}] = found.route.handlers;

      let user = null;
      if (!opts.public) {
        const auth = String(req.headers.authorization || '');
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        user = verifyToken(token, config.authSecret);
        if (!user) throw new HttpError(401, 'Please log in');
      }

      let body = {};
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        body = parseBody(await readBody(req, BODY_LIMIT), req.headers['content-type']);
        if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};
      }

      const result = await fn({
        req,
        res,
        params: found.params,
        query: Object.fromEntries(url.searchParams),
        body,
        user,
        ip: clientIp(req, config.trustProxy),
      });
      if (!res.headersSent) sendJson(res, 200, result === undefined ? { ok: true } : result);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) logger.error('[http]', err);
      if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'Server error' : err.message });
    }
  };
}

module.exports = { createApp };
