// Full flow through the real HTTP API + the real sender, with an in-memory DB
// and a fake SMTP. Time is simulated in IST.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, fakeMailer, ist } = require('./helpers');
const { handleIncoming } = require('../src/services/replies');

const CSV = [
  'Business Name,Email,Contact Person,City,Phone',
  'Sharma Dental,info@sharmadental.in,Dr Ravi Sharma,Delhi,9810000001',
  'UrbanFit Gym,hello@urbanfit.in,Amit,Noida,9810000002',
  'Green Leaf Cafe,greenleaf@gmail.com,,Delhi,',
  'Bad Row,not-an-email,X,Delhi,',
  'Dup Row,INFO@sharmadental.in,Dup,Delhi,',
].join('\n');

test('end-to-end: login → import → schedule → follow-up → reply stop → unsubscribe → pause', async (t) => {
  const s = await startServer();
  t.after(() => s.close());

  // ---------- auth ----------
  let r = await s.api('GET', '/api/leads');
  assert.equal(r.status, 401, 'API locked without login');
  r = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  assert.equal(r.status, 401);
  r = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' });
  assert.equal(r.status, 200);
  s.setToken(r.data.token);
  r = await s.api('GET', '/api/auth/me');
  assert.equal(r.data.username, 'admin');

  // ---------- CORS ----------
  const pre = await fetch(s.base + '/api/leads', { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000' } });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  const evil = await fetch(s.base + '/api/leads', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);

  // ---------- import ----------
  r = await s.api('POST', '/api/leads/import', { csv: CSV });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.added, 3);
  assert.equal(r.data.invalid, 1);
  assert.equal(r.data.duplicates, 1, 'same email repeated inside the file is skipped');
  assert.equal(r.data.duplicateEmails.length, 1);
  r = await s.api('POST', '/api/leads/import', { csv: CSV });
  assert.equal(r.data.added, 0);
  assert.equal(r.data.duplicates, 4, 're-upload never creates duplicates (3 existing + 1 repeat row)');
  assert.equal(r.data.duplicateEmails.length, 3);

  r = await s.api('GET', '/api/leads?limit=10');
  assert.equal(r.data.total, 3);
  assert.equal(r.data.counts.queued, 3);
  assert.equal(r.data.items[0].unsubToken, undefined, 'tokens never leak to the UI');
  const leadsByEmail = Object.fromEntries((await s.repo.listLeads({ limit: 10 })).items.map((l) => [l.email, l]));
  const sharma = leadsByEmail['info@sharmadental.in'];
  const urban = leadsByEmail['hello@urbanfit.in'];
  const green = leadsByEmail['greenleaf@gmail.com'];

  // make the queue order deterministic & due
  await s.repo.updateLead(sharma.id, { nextSendAt: ist(2026, 11, 1, 0, 0) });
  await s.repo.updateLead(urban.id, { nextSendAt: ist(2026, 11, 1, 0, 1) });
  await s.repo.updateLead(green.id, { nextSendAt: ist(2026, 11, 1, 0, 2) });

  // ---------- Monday 9 Nov 2026 ----------
  let res = await s.sender.runTick(ist(2026, 11, 9, 8, 30));
  assert.equal(res.sent, false, 'nothing before 9 AM');
  res = await s.sender.runTick(ist(2026, 11, 9, 9, 0));
  assert.equal(res.sent, true);
  assert.equal(s.mailer.sent[0].to, 'info@sharmadental.in');
  assert.equal(s.mailer.sent[0].subject, 'A quick question about Sharma Dental');
  assert.match(s.mailer.sent[0].text, /^Hi Ravi,/); // "Dr" title skipped
  assert.match(s.mailer.sent[0].text, /unsubscribe here: https:\/\/api\.example\.test\/u\//);
  assert.match(s.mailer.sent[0].headers['List-Unsubscribe'], /^<https:\/\/api\.example\.test\/u\/.+>, <mailto:.+>$/);

  res = await s.sender.runTick(ist(2026, 11, 9, 9, 30));
  assert.equal(res.sent, false, '1 hour gap');
  res = await s.sender.runTick(ist(2026, 11, 9, 10, 0));
  assert.equal(s.mailer.sent[1].to, 'hello@urbanfit.in');
  res = await s.sender.runTick(ist(2026, 11, 9, 11, 0));
  assert.equal(s.mailer.sent[2].to, 'greenleaf@gmail.com');
  assert.match(s.mailer.sent[2].text, /^Hi there,/, 'fallback when name is missing');
  res = await s.sender.runTick(ist(2026, 11, 9, 12, 0));
  assert.equal(res.sent, false, 'no lead due — follow-ups wait 3 days');

  let lead = await s.repo.getLead(sharma.id);
  assert.equal(lead.status, 'active');
  assert.equal(lead.step, 1);
  assert.equal(lead.nextSendAt.toISOString(), ist(2026, 11, 12, 9, 0).toISOString(), 'Mail 2 after 3 days');

  // ---------- Thursday 12 Nov: Mail 2 in same thread ----------
  res = await s.sender.runTick(ist(2026, 11, 12, 9, 0));
  assert.equal(res.sent, true);
  const m2 = s.mailer.sent[3];
  assert.equal(m2.to, 'info@sharmadental.in');
  assert.equal(m2.subject, 'Re: A quick question about Sharma Dental');
  assert.equal(m2.inReplyTo, s.mailer.sent[0].messageId);
  assert.deepEqual(m2.references, [s.mailer.sent[0].messageId]);
  lead = await s.repo.getLead(sharma.id);
  assert.equal(lead.nextSendAt.toISOString(), ist(2026, 11, 17, 9, 0).toISOString(), 'Mail 3 after 5 days');

  // ---------- Sharma replies → sequence stops ----------
  let h = await handleIncoming({
    repo: s.repo,
    msg: { messageId: '<reply1@sharma>', from: 'info@sharmadental.in', fromName: 'Dr Sharma', subject: 'Re: Quick question', text: 'Yes, send the mockup. Need booking too.', date: ist(2026, 11, 12, 13, 0), inReplyTo: m2.messageId, references: [s.mailer.sent[0].messageId, m2.messageId], headers: {} },
  });
  assert.equal(h.action, 'replied');
  h = await handleIncoming({ repo: s.repo, msg: { messageId: '<reply1@sharma>', from: 'info@sharmadental.in', subject: 'x', text: 'x', headers: {} } });
  assert.equal(h.action, 'duplicate', 'same reply counted once');
  lead = await s.repo.getLead(sharma.id);
  assert.equal(lead.status, 'replied');
  assert.equal(lead.repliedAfterStep, 2);
  assert.equal(lead.nextSendAt, null);

  // ---------- UrbanFit out-of-office → keeps going ----------
  h = await handleIncoming({ repo: s.repo, msg: { messageId: '<ooo@urban>', from: 'hello@urbanfit.in', subject: 'Automatic reply: On leave', text: 'I am away', headers: {} } });
  assert.equal(h.action, 'auto-reply');
  assert.equal((await s.repo.getLead(urban.id)).status, 'active');

  // ---------- Green Leaf unsubscribes from the mail link ----------
  const greenFull = await s.repo.getLead(green.id);
  let page = await fetch(`${s.base}/u/${greenFull.unsubToken}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Unsubscribe\?/);
  page = await fetch(`${s.base}/u/${greenFull.unsubToken}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /unsubscribed/i);
  assert.equal((await fetch(`${s.base}/u/bad-token`)).status, 404);
  r = await s.api('GET', '/api/unsubscribed');
  assert.equal(r.data.total, 1);
  assert.equal(r.data.items[0].email, 'greenleaf@gmail.com');
  r = await s.api('POST', `/api/leads/${green.id}/resume`);
  assert.equal(r.status, 400, 'unsubscribed can never be resumed');

  // ---------- Sunday 15 Nov: nothing ----------
  await s.repo.updateLead(urban.id, { nextSendAt: ist(2026, 11, 14, 0, 0) });
  res = await s.sender.runTick(ist(2026, 11, 15, 10, 0));
  assert.match(res.reason, /Sunday/);
  // ---------- Monday 16 Nov: UrbanFit gets Mail 2, nobody else ----------
  const before = s.mailer.sent.length;
  res = await s.sender.runTick(ist(2026, 11, 16, 9, 0));
  assert.equal(res.sent, true);
  assert.equal(s.mailer.sent[before].to, 'hello@urbanfit.in');
  for (let hh = 10; hh < 19; hh++) await s.sender.runTick(ist(2026, 11, 16, hh, 0));
  assert.equal(s.mailer.sent.length, before + 1, 'replied + unsubscribed leads get nothing');

  // ---------- holiday ----------
  await s.repo.updateLead(urban.id, { nextSendAt: ist(2026, 11, 20, 0, 0) });
  res = await s.sender.runTick(ist(2026, 11, 24, 10, 0));
  assert.match(res.reason, /Guru Nanak/);

  // ---------- global pause ----------
  r = await s.api('POST', '/api/system/pause');
  assert.equal(r.data.paused, true);
  res = await s.sender.runTick(ist(2026, 11, 25, 10, 0));
  assert.match(res.reason, /paused/);
  r = await s.api('POST', '/api/system/resume');
  assert.equal(r.data.paused, false);

  // ---------- stop / resume single lead ----------
  r = await s.api('POST', `/api/leads/${urban.id}/stop`);
  assert.equal(r.data.lead.status, 'stopped');
  res = await s.sender.runTick(ist(2026, 11, 25, 10, 0));
  assert.equal(res.sent, false);
  r = await s.api('POST', `/api/leads/${urban.id}/resume`);
  assert.equal(r.data.lead.status, 'active');

  // ---------- settings validation ----------
  r = await s.api('PUT', '/api/settings', { dailyLimit: 50 });
  assert.equal(r.status, 400, 'can never go above MAX_DAILY_LIMIT (10)');
  r = await s.api('PUT', '/api/settings', { startHour: 20, endHour: 19 });
  assert.equal(r.status, 400);
  r = await s.api('PUT', '/api/settings', { holidays: [{ date: '2026-11-25', name: 'Office off' }, { date: 'bad' }] });
  assert.equal(r.data.holidays.length, 1);
  res = await s.sender.runTick(ist(2026, 11, 25, 11, 0));
  assert.match(res.reason, /Office off/);

  // ---------- sequence edit ----------
  r = await s.api('GET', '/api/sequence');
  assert.equal(r.data.steps.length, 6);
  assert.deepEqual(r.data.steps.map((x) => x.delayDays), [0, 3, 5, 7, 10, 14]);
  const steps = r.data.steps.map((x) => ({ ...x }));
  steps[0].subject = '';
  r = await s.api('PUT', '/api/sequence', { steps });
  assert.equal(r.status, 400, 'Mail 1 subject required');
  steps[0].subject = 'New website idea for {{company}}';
  r = await s.api('PUT', '/api/sequence', { steps });
  assert.equal(r.status, 200);
  r = await s.api('POST', '/api/sequence/preview', { index: 1 });
  assert.equal(r.data.subject, 'Re: New website idea for Sharma Dental Care');

  // ---------- lead detail + dashboard ----------
  r = await s.api('GET', `/api/leads/${sharma.id}`);
  assert.equal(r.data.logs.filter((l) => l.direction === 'out').length, 2);
  assert.equal(r.data.logs.filter((l) => l.kind === 'reply').length, 1);
  r = await s.api('GET', '/api/replies');
  assert.equal(r.data.items[0].email, 'info@sharmadental.in');
  r = await s.api('GET', '/api/dashboard');
  assert.equal(r.status, 200);
  assert.equal(r.data.counts.total, 3);
  assert.equal(r.data.counts.replied, 1);
  assert.equal(r.data.counts.unsubscribed, 1);
  assert.equal(r.data.totalSent, 5);
  assert.equal(r.data.recentReplies.length, 1);

  // ---------- edit + delete ----------
  r = await s.api('PATCH', `/api/leads/${urban.id}`, { phone: '999', email: 'hacker@x.com' });
  assert.equal(r.data.lead.phone, '999');
  assert.equal(r.data.lead.email, 'hello@urbanfit.in', 'email cannot be changed');
  r = await s.api('DELETE', `/api/leads/${urban.id}`);
  assert.equal(r.data.ok, true);
  r = await s.api('GET', `/api/leads/${urban.id}`);
  assert.equal(r.status, 404);
});

test('daily limit 10 + full 6-mail sequence completes', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const lines = ['email,name'];
  for (let i = 0; i < 15; i++) lines.push(`lead${i}@biz${i}.in,Owner ${i}`);
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((r) => s.setToken(r.data.token));
  await s.api('POST', '/api/leads/import', { csv: lines.join('\n') });
  const all = (await s.repo.listLeads({ limit: 50 })).items;
  for (const l of all) await s.repo.updateLead(l.id, { nextSendAt: ist(2026, 11, 1, 0, 0) });

  for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 5) await s.sender.runTick(ist(2026, 11, 9, h, m));
  assert.equal(s.mailer.sent.length, 10, 'exactly 10 on Monday');
  const hours = s.mailer.sent.map((x, i) => i);
  assert.equal(hours.length, 10);

  // one lead through the whole sequence
  const one = all[0];
  await s.repo.updateLead(one.id, { status: 'active', step: 5, nextSendAt: ist(2026, 11, 1, 0, 0), messageIds: ['<a@x>'], threadSubject: 'Hi' });
  for (const l of all.slice(1)) await s.repo.updateLead(l.id, { status: 'stopped', nextSendAt: null });
  const res = await s.sender.runTick(ist(2026, 11, 10, 9, 0));
  assert.equal(res.step, 6);
  const done = await s.repo.getLead(one.id);
  assert.equal(done.status, 'completed');
  assert.equal(done.nextSendAt, null);
});

test('SMTP failure retries, then stops after 3 fails; bounce marks lead', async (t) => {
  const s = await startServer({ mailer: fakeMailer({ failFor: ['broken@x.in'] }) });
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((r) => s.setToken(r.data.token));
  await s.api('POST', '/api/leads', { email: 'broken@x.in', name: 'B' });
  await s.api('POST', '/api/leads', { email: 'ok@x.in', name: 'O' });
  r = await s.api('POST', '/api/leads', { email: 'ok@x.in' });
  assert.equal(r.status, 409);
  const [broken] = (await s.repo.listLeads({ q: 'broken' })).items;
  await s.repo.updateLead(broken.id, { nextSendAt: ist(2026, 11, 1, 0, 0) });
  for (let i = 0; i < 3; i++) {
    const lead = await s.repo.getLead(broken.id);
    await s.repo.updateLead(broken.id, { nextSendAt: ist(2026, 11, 1, 0, 0) });
    const res = await s.sender.runTick(ist(2026, 11, 9, 9, i));
    assert.equal(res.sent, false);
    assert.ok(lead);
  }
  assert.equal((await s.repo.getLead(broken.id)).status, 'stopped');

  const [ok] = (await s.repo.listLeads({ q: 'ok@' })).items;
  await s.repo.updateLead(ok.id, { nextSendAt: ist(2026, 11, 1, 0, 0) }); // due, independent of today's real date
  const res = await s.sender.runTick(ist(2026, 11, 9, 10, 0));
  assert.equal(res.sent, true);
  const h = await handleIncoming({ repo: s.repo, msg: { messageId: '<b1>', from: 'mailer-daemon@googlemail.com', subject: 'Delivery Status Notification (Failure)', text: 'Address not found: ok@x.in', headers: {} } });
  assert.equal(h.action, 'bounced');
  assert.equal((await s.repo.getLead(ok.id)).status, 'bounced');
});

let r;

test('login rate limit blocks after 5 wrong passwords', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  for (let i = 0; i < 5; i++) await s.api('POST', '/api/auth/login', { username: 'admin', password: 'nope' });
  const res = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' });
  assert.equal(res.status, 429);
});

test('signature + From name: default, edited from Settings, used in every mail', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));

  let r = await s.api('GET', '/api/settings');
  assert.equal(r.data.fromName, 'Bhargav from SiteCraft');
  assert.deepEqual(r.data.signature, { closing: 'Best regards,', name: 'SiteCraft by Bhargav', phone: '' });

  await s.api('POST', '/api/leads', { email: 'owner@cafe.in', name: 'Priya', company: 'Cafe Bloom' });
  const [lead] = (await s.repo.listLeads({})).items;
  await s.repo.updateLead(lead.id, { nextSendAt: ist(2026, 11, 1, 0, 0) });

  // Mail 1 with default signature
  await s.sender.runTick(ist(2026, 11, 9, 9, 0));
  const m1 = s.mailer.sent[0];
  assert.equal(m1.fromName, 'Bhargav from SiteCraft');
  assert.match(m1.text, /I'm Bhargav from SiteCraft\./);
  assert.match(m1.text, /Would you be open to a quick chat\?\n\nBest regards,\nSiteCraft by Bhargav\n\n--\nIf you don't want/);
  assert.match(m1.html, /Best regards,<br>SiteCraft by Bhargav<\/p>/);
  assert.doesNotMatch(m1.text + m1.html, /geek/i, 'no "Geek" anywhere');

  // change name + phone from the frontend (Settings)
  r = await s.api('PUT', '/api/settings', { fromName: 'Bhargav | SiteCraft', senderName: 'Bhargav', signature: { closing: 'Best regards,', name: 'SiteCraft by Bhargav', phone: '+91 98765 43210' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.signature.phone, '+91 98765 43210');
  r = await s.api('PUT', '/api/settings', { fromName: '   ' });
  assert.equal(r.status, 400, 'From name cannot be empty');

  // Mail 2 uses the new values
  await s.sender.runTick(ist(2026, 11, 12, 9, 0));
  const m2 = s.mailer.sent[1];
  assert.equal(m2.fromName, 'Bhargav | SiteCraft');
  assert.match(m2.text, /Best regards,\nSiteCraft by Bhargav\n\+91 98765 43210\n\n--/);

  // preview + test mail show the same signature
  r = await s.api('POST', '/api/sequence/preview', { index: 0 });
  assert.match(r.data.text, /\+91 98765 43210/);
  assert.equal(r.data.from, 'Bhargav | SiteCraft <bhargav.sitecraft@gmail.com>');
  r = await s.api('POST', '/api/system/test-email', { index: 2 });
  assert.equal(r.status, 200);
  assert.match(s.mailer.sent.at(-1).text, /SiteCraft by Bhargav\n\+91 98765 43210/);
  assert.equal(s.mailer.sent.at(-1).fromName, 'Bhargav | SiteCraft');
});

test('admin login is seeded into the DB (hashed), case-insensitive username, reset via seed', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const { setAdmin, ensureAdminSeeded } = require('../src/services/admin');

  const stored = await s.repo.getAdmin('admin');
  assert.ok(stored, 'admin saved in DB');
  assert.match(stored.passwordHash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.ok(!stored.passwordHash.includes('super-secret-pass'), 'password never stored as plain text');
  assert.equal((await ensureAdminSeeded(s.repo, s.config, { log() {} })).seeded, false, 'seed runs only once');

  let r = await s.api('POST', '/api/auth/login', { username: 'ADMIN', password: 'super-secret-pass' });
  assert.equal(r.status, 200, 'username case does not matter');
  r = await s.api('POST', '/api/auth/login', { username: '  admin ', password: 'super-secret-pass' });
  assert.equal(r.status, 200, 'spaces around username ignored');
  r = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'SUPER-secret-pass' });
  assert.equal(r.status, 401, 'password is case sensitive');
  r = await s.api('POST', '/api/auth/login', { username: 'nobody', password: 'super-secret-pass' });
  assert.equal(r.status, 401);

  // npm run seed -- SiteCraft NewPass@123
  await setAdmin(s.repo, 'SiteCraft', 'NewPass@123');
  r = await s.api('POST', '/api/auth/login', { username: 'sitecraft', password: 'NewPass@123' });
  assert.equal(r.status, 200);
  assert.equal(r.data.username, 'SiteCraft');
  await setAdmin(s.repo, 'admin', 'changed-pass-1');
  r = await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' });
  assert.equal(r.status, 401, 'old password stops working after reset');
  await assert.rejects(() => setAdmin(s.repo, 'x', 'short'), /8 characters/);
});

test('IMAP errors are explained in plain English', () => {
  const { explainImapError } = require('../src/services/imapPoller');
  const cfg = { imap: { user: 'sitecraft94@gmail.com', host: 'imap.gmail.com', port: 993 } };
  const e = Object.assign(new Error('Command failed'), { authenticationFailed: true, responseText: 'Invalid credentials (Failure)' });
  assert.match(explainImapError(e, cfg), /Gmail login failed for sitecraft94@gmail\.com.*App Password/);
  assert.match(explainImapError(Object.assign(new Error('x'), { code: 'ENOTFOUND' }), cfg), /Could not reach the IMAP server/);
});

test('default emails: proper English, no "free" offers, restore button resets an edited sequence', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));
  let r = await s.api('GET', '/api/sequence');
  const all = r.data.steps.map((x) => x.subject + '\n' + x.body).join('\n');
  assert.doesNotMatch(all, /\bfree\b|mockup|guarantee|cheap/i, 'no spammy offers');
  assert.match(r.data.steps[0].body, /Fast delivery/);
  assert.match(r.data.steps[0].body, /Fair pricing/);
  assert.deepEqual(r.data.steps.map((x) => x.delayDays), [0, 3, 5, 7, 10, 14]);
  assert.ok(r.data.steps.slice(1).every((x) => x.subject === ''), 'follow-ups stay in the same thread');

  const edited = r.data.steps.map((x) => ({ ...x }));
  edited[0].body = 'Old text';
  await s.api('PUT', '/api/sequence', { steps: edited });
  r = await s.api('GET', '/api/sequence');
  assert.equal(r.data.steps[0].body, 'Old text');
  r = await s.api('POST', '/api/sequence/reset');
  assert.equal(r.status, 200);
  r = await s.api('GET', '/api/sequence');
  assert.match(r.data.steps[0].body, /I'm \{\{sender_name\}\} from SiteCraft/);

  // what a real lead receives
  r = await s.api('POST', '/api/sequence/preview', { index: 0 });
  assert.equal(r.data.subject, 'A quick question about Sharma Dental Care');
  assert.match(r.data.text, /^Hi Rahul,\n\nI'm Bhargav from SiteCraft\./);
  r = await s.api('POST', '/api/sequence/preview', { index: 3 });
  assert.equal(r.data.subject, 'Re: A quick question about Sharma Dental Care');
});

test('first email comes from each lead\'s own CSV row; follow-ups come from the Sequence page', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));
  const csv = [
    'company,email,name,subject,message',
    'Sharma Dental,info@sharmadental.in,Dr Ravi Sharma,Website for Sharma Dental,"Hi {{first_name}},',
    '',
    'I saw Sharma Dental on Google Maps — your clinic has great reviews but no website yet.',
    '',
    'We can build one that lets patients book online. Interested?"',
    'UrbanFit Gym,hello@urbanfit.in,Amit,Your gym app idea,"Hi Amit, quick one about a member app for UrbanFit."',
    'Green Leaf Cafe,greenleaf@gmail.com,Neha,,',
  ].join('\n');
  let r = await s.api('POST', '/api/leads/import', { csv });
  assert.equal(r.data.added, 3);
  assert.equal(r.data.withOwnFirstEmail, 2);

  const leads = Object.fromEntries((await s.repo.listLeads({ limit: 10 })).items.map((l) => [l.email, l]));
  assert.equal(leads['info@sharmadental.in'].firstSubject, 'Website for Sharma Dental');
  assert.match(leads['info@sharmadental.in'].firstMessage, /^Hi \{\{first_name\}\},\n\nI saw Sharma Dental on Google Maps/);
  let i = 0;
  for (const email of ['info@sharmadental.in', 'hello@urbanfit.in', 'greenleaf@gmail.com']) await s.repo.updateLead(leads[email].id, { nextSendAt: ist(2026, 11, 1, 0, i++) });

  await s.sender.runTick(ist(2026, 11, 10, 9, 0));
  await s.sender.runTick(ist(2026, 11, 10, 10, 0));
  await s.sender.runTick(ist(2026, 11, 10, 11, 0));
  const [m1, m2, m3] = s.mailer.sent;
  assert.equal(m1.subject, 'Website for Sharma Dental');
  assert.match(m1.text, /^Hi Ravi,\n\nI saw Sharma Dental on Google Maps.*\n\nWe can build one that lets patients book online\. Interested\?\n\nBest regards,\nSiteCraft by Bhargav/s);
  assert.equal(m2.subject, 'Your gym app idea');
  assert.match(m2.text, /^Hi Amit, quick one about a member app for UrbanFit\./);
  assert.equal(m3.subject, 'A quick question about Green Leaf Cafe', 'no message in CSV -> default Email 1');
  assert.match(m3.text, /I'm Bhargav from SiteCraft/);

  // follow-up uses the Sequence page text, in the thread of the lead's own subject
  await s.sender.runTick(ist(2026, 11, 13, 9, 0));
  const f = s.mailer.sent[3];
  assert.equal(f.to, 'info@sharmadental.in');
  assert.equal(f.subject, 'Re: Website for Sharma Dental');
  assert.match(f.text, /Just bringing my last email back to the top of your inbox/);

  // edit a lead's first email before it is sent + preview it
  await s.api('POST', '/api/leads', { email: 'new@biz.in', name: 'Karan', company: 'Biz', firstSubject: 'Hello Biz', firstMessage: 'Hi {{first_name}}, short note.' });
  const nl = await s.repo.getLeadByEmail('new@biz.in');
  r = await s.api('PATCH', `/api/leads/${nl.id}`, { firstMessage: 'Hi {{first_name}}, updated note for {{company}}.' });
  assert.equal(r.data.lead.firstMessage, 'Hi {{first_name}}, updated note for {{company}}.');
  r = await s.api('POST', '/api/sequence/preview', { index: 0, leadId: nl.id });
  assert.equal(r.data.subject, 'Hello Biz');
  assert.match(r.data.text, /^Hi Karan, updated note for Biz\./);
  r = await s.api('POST', '/api/sequence/preview', { index: 1, leadId: nl.id });
  assert.equal(r.data.subject, 'Re: Hello Biz');
});

test('test email looks like a real email, never creates a lead, unsubscribe page explains it', async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));
  let r = await s.api('POST', '/api/system/test-email', { to: 'mohitr9334@gmail.com', index: 0 });
  assert.equal(r.status, 200);
  const m = s.mailer.sent[0];
  assert.equal(m.to, 'mohitr9334@gmail.com');
  assert.equal(m.subject, 'A quick question about your website', 'no [TEST] prefix');
  assert.match(m.text, /^Hi there,\n\nI'm Bhargav from SiteCraft/);
  assert.match(m.text, /Best regards,\nSiteCraft by Bhargav/);
  assert.match(m.headers['List-Unsubscribe'], /\/u\/test-preview>, <mailto:bhargav\.sitecraft@gmail\.com\?subject=Unsubscribe>$/);
  assert.equal(m.fromName, 'Bhargav from SiteCraft');
  r = await s.api('GET', '/api/leads');
  assert.equal(r.data.total, 0, 'test email never creates a lead (no follow-ups)');
  for (let d = 10; d <= 30; d++) await s.sender.runTick(ist(2026, 11, d, 10, 0));
  assert.equal(s.mailer.sent.length, 1, 'nothing else is ever sent to that address');
  r = await s.api('POST', '/api/system/test-email', { to: 'x@y.in', index: 2, name: 'Mohit' });
  assert.equal(s.mailer.sent[1].subject, 'Re: A quick question about your website');
  assert.match(s.mailer.sent[1].text, /^Hi Mohit,/);
  const page = await fetch(s.base + '/u/test-preview');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /This was a test email/);
});

test('no domain (localhost): lead replies "unsubscribe" -> Unsubscribed list, no more follow-ups', async (t) => {
  const s = await startServer({ config: { publicBackendUrl: 'http://localhost:5001' } });
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));
  await s.api('POST', '/api/leads/import', { csv: 'company,email,name,subject,message\nABC Traders,owner@abc.in,Rohit,Website for ABC,"Hi Rohit, quick note."\nXYZ Foods,hi@xyz.in,Sana,Website for XYZ,"Hi Sana, quick note."' });
  const leads = (await s.repo.listLeads({ limit: 10 })).items;
  let i = 0;
  for (const l of leads) await s.repo.updateLead(l.id, { nextSendAt: ist(2026, 11, 1, 0, i++) });
  await s.sender.runTick(ist(2026, 11, 10, 9, 0));
  await s.sender.runTick(ist(2026, 11, 10, 10, 0));
  const m = s.mailer.sent.find((x) => x.to === 'owner@abc.in');
  assert.match(m.text, /just reply with "unsubscribe" and I won't email you again\.$/);
  assert.doesNotMatch(m.text + m.html, /localhost/);
  assert.equal(m.headers['List-Unsubscribe'], '<mailto:bhargav.sitecraft@gmail.com?subject=Unsubscribe>');
  assert.equal(m.headers['List-Unsubscribe-Post'], undefined);

  // Rohit replies "unsubscribe" in the thread (quoted mail below it)
  let h = await handleIncoming({ repo: s.repo, msg: { messageId: '<u1@abc>', from: 'owner@abc.in', inReplyTo: m.messageId, subject: 'Re: Website for ABC', text: 'Unsubscribe\n\nOn Tue, Bhargav from SiteCraft wrote:\n> Hi Rohit, quick note.', headers: {} } });
  assert.equal(h.action, 'unsubscribed');
  // Sana uses Gmail's "Unsubscribe" button (mailto, no thread headers)
  h = await handleIncoming({ repo: s.repo, msg: { messageId: '<u2@xyz>', from: 'hi@xyz.in', subject: 'Unsubscribe', text: 'This message was automatically generated by Gmail.', headers: {} } });
  assert.equal(h.action, 'unsubscribed');

  let r = await s.api('GET', '/api/unsubscribed');
  assert.deepEqual(r.data.items.map((x) => x.email).sort(), ['hi@xyz.in', 'owner@abc.in']);
  const before = s.mailer.sent.length;
  await s.sender.runTick(ist(2026, 11, 13, 9, 0));
  await s.sender.runTick(ist(2026, 11, 13, 10, 0));
  assert.equal(s.mailer.sent.length, before, 'no follow-ups after unsubscribe');

  r = await s.api('GET', '/api/system/status');
  assert.equal(r.data.unsubscribeMode, 'reply');
  // test email without a domain: mailto header only
  await s.api('POST', '/api/system/test-email', { to: 'me@test.in' });
  const tm = s.mailer.sent[s.mailer.sent.length - 1];
  assert.equal(tm.headers['List-Unsubscribe'], '<mailto:bhargav.sitecraft@gmail.com?subject=Unsubscribe>');
  assert.match(tm.text, /reply with "unsubscribe"/);
});

test('sender stores the Message-ID + Gmail thread returned by the mailer, follow-up stays in that thread, reply still matches', async (t) => {
  const sent = [];
  let n = 0;
  const mailer = {
    sent, dryRun: false,
    async verify() { return { ok: true, message: 'fake' }; },
    async send(mail) { sent.push(mail); n++; return { messageId: `<gmail-${n}@mail.gmail.com>`, threadId: 'thread-A' }; },
  };
  const s = await startServer({ mailer });
  t.after(() => s.close());
  await s.api('POST', '/api/auth/login', { username: 'admin', password: 'super-secret-pass' }).then((x) => s.setToken(x.data.token));
  await s.api('POST', '/api/leads', { email: 'owner@shop.in', name: 'Raj', company: 'Shop' });
  const lead0 = await s.repo.getLeadByEmail('owner@shop.in');
  await s.repo.updateLead(lead0.id, { nextSendAt: ist(2026, 11, 1, 0) });
  await s.sender.runTick(ist(2026, 11, 10, 9, 0));
  let lead = await s.repo.getLeadByEmail('owner@shop.in');
  assert.equal(lead.gmailThreadId, 'thread-A');
  assert.ok(lead.messageIds.includes('<gmail-1@mail.gmail.com>'), 'real Gmail Message-ID kept');
  assert.equal(sent[0].threadId, undefined);

  await s.sender.runTick(ist(2026, 11, 13, 9, 0));
  assert.equal(sent[1].threadId, 'thread-A', 'follow-up goes in the same Gmail thread');
  assert.ok(sent[1].references.includes('<gmail-1@mail.gmail.com>'));

  const h = await handleIncoming({ repo: s.repo, msg: { messageId: '<r@shop>', from: 'someone-else@shop.in', inReplyTo: '<gmail-2@mail.gmail.com>', subject: 'Re: x', text: 'Interested', headers: {} } });
  assert.equal(h.action, 'replied', 'reply to the Gmail-assigned Message-ID is matched');
});
