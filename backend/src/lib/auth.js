// Login + signed session tokens (HMAC-SHA256) using only Node's crypto.
const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromB64url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signToken(payload, secret, ttlSeconds) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64url(JSON.stringify(body));
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verifyToken(token, secret) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expected = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const body = JSON.parse(fromB64url(data).toString('utf8'));
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

/** Blocks an IP after too many wrong passwords. */
function createLoginLimiter({ maxAttempts = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return {
    isBlocked(ip) {
      const a = attempts.get(ip);
      if (!a) return 0;
      if (Date.now() - a.first > windowMs) {
        attempts.delete(ip);
        return 0;
      }
      return a.count >= maxAttempts ? Math.ceil((a.first + windowMs - Date.now()) / 60000) : 0;
    },
    fail(ip) {
      const a = attempts.get(ip);
      if (!a || Date.now() - a.first > windowMs) attempts.set(ip, { count: 1, first: Date.now() });
      else a.count++;
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
}

/** scrypt password hash: "scrypt$<salt>$<hash>" (salted, slow on purpose). */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(actual, expected);
}

function randomToken(bytes = 24) {
  return b64url(crypto.randomBytes(bytes));
}

module.exports = { signToken, verifyToken, safeEqual, createLoginLimiter, randomToken, hashPassword, verifyPassword };
