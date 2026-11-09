// In-memory repository with the same interface as mongoRepo.
// Used by the automated tests (and handy for a quick local demo).
const crypto = require('crypto');
const { SENDABLE, escapeRegex } = require('./leadQuery');

const clone = (v) => (v === null || v === undefined ? v : structuredClone(v));
const newId = () => crypto.randomBytes(12).toString('hex');

function createMemoryRepo() {
  const leads = new Map();
  const logs = [];
  let settings = null;
  let sequence = null;
  const admins = new Map();

  const byNext = (a, b) =>
    (a.nextSendAt?.getTime() ?? 0) - (b.nextSendAt?.getTime() ?? 0) || a.createdAt - b.createdAt;

  return {
    kind: 'memory',
    async init() {},
    async close() {},

    // ---------- leads ----------
    async insertLeads(list) {
      const inserted = [];
      const duplicates = [];
      for (const l of list) {
        const exists = [...leads.values()].some((x) => x.email === l.email);
        if (exists) {
          duplicates.push(l.email);
          continue;
        }
        const doc = { ...clone(l), id: newId() };
        leads.set(doc.id, doc);
        inserted.push(clone(doc));
      }
      return { inserted, duplicates };
    },
    async listLeads({ status, q, page = 1, limit = 50 } = {}) {
      let items = [...leads.values()];
      if (status) items = items.filter((l) => l.status === status);
      if (q) {
        const re = new RegExp(escapeRegex(q), 'i');
        items = items.filter((l) => re.test(l.email) || re.test(l.name || '') || re.test(l.company || '') || re.test(l.city || ''));
      }
      items.sort((a, b) => b.createdAt - a.createdAt);
      const total = items.length;
      return { items: clone(items.slice((page - 1) * limit, page * limit)), total };
    },
    async getLead(id) {
      return clone(leads.get(id) || null);
    },
    async getLeadByEmail(email) {
      return clone([...leads.values()].find((l) => l.email === String(email).toLowerCase()) || null);
    },
    async getLeadByUnsubToken(token) {
      return clone([...leads.values()].find((l) => l.unsubToken === token) || null);
    },
    async getLeadByMessageIds(ids) {
      const set = new Set(ids);
      return clone([...leads.values()].find((l) => (l.messageIds || []).some((m) => set.has(m))) || null);
    },
    async updateLead(id, patch) {
      const l = leads.get(id);
      if (!l) return null;
      Object.assign(l, clone(patch), { updatedAt: new Date() });
      return clone(l);
    },
    async deleteLead(id) {
      const ok = leads.delete(id);
      for (let i = logs.length - 1; i >= 0; i--) if (logs[i].leadId === id) logs.splice(i, 1);
      return ok;
    },
    async findNextDueLead(now) {
      const due = [...leads.values()].filter((l) => SENDABLE.includes(l.status) && l.nextSendAt && l.nextSendAt <= now);
      const active = due.filter((l) => l.status === 'active').sort(byNext);
      if (active.length) return clone(active[0]);
      const queued = due.filter((l) => l.status === 'queued').sort(byNext);
      return clone(queued[0] || null);
    },
    async upcomingLeads(limit = 10) {
      const items = [...leads.values()].filter((l) => SENDABLE.includes(l.status) && l.nextSendAt);
      items.sort((a, b) => (a.status === b.status ? byNext(a, b) : a.status === 'active' ? -1 : 1));
      return clone(items.slice(0, limit));
    },
    async countLeadsByStatus() {
      const out = {};
      for (const l of leads.values()) out[l.status] = (out[l.status] || 0) + 1;
      return out;
    },

    // ---------- logs ----------
    async addLog(log) {
      const doc = { ...clone(log), id: newId() };
      logs.push(doc);
      return clone(doc);
    },
    async logExistsByMessageId(messageId) {
      return logs.some((l) => l.messageId === messageId);
    },
    async listLogsForLead(leadId) {
      return clone(logs.filter((l) => l.leadId === leadId).sort((a, b) => a.at - b.at));
    },
    async countSent(from, to) {
      return logs.filter((l) => l.direction === 'out' && l.status === 'sent' && (!from || l.at >= from) && (!to || l.at < to)).length;
    },
    async lastSent() {
      const sent = logs.filter((l) => l.direction === 'out' && l.status === 'sent').sort((a, b) => b.at - a.at);
      return clone(sent[0] || null);
    },
    async sentBetween(from, to) {
      return clone(logs.filter((l) => l.direction === 'out' && l.status === 'sent' && l.at >= from && l.at < to).sort((a, b) => a.at - b.at));
    },
    async listInbound({ kind, page = 1, limit = 50 } = {}) {
      let items = logs.filter((l) => l.direction === 'in' && (!kind || l.kind === kind));
      items.sort((a, b) => b.at - a.at);
      return { items: clone(items.slice((page - 1) * limit, page * limit)), total: items.length };
    },

    // ---------- admins ----------
    async getAdmin(username) {
      return clone(admins.get(String(username).toLowerCase()) || null);
    },
    async upsertAdmin({ username, passwordHash }) {
      const key = String(username).toLowerCase();
      const now = new Date();
      const prev = admins.get(key);
      admins.set(key, { username: key, displayName: username, passwordHash, createdAt: prev ? prev.createdAt : now, updatedAt: now });
      return { created: !prev };
    },
    async countAdmins() {
      return admins.size;
    },

    // ---------- settings / sequence ----------
    async getSettings() {
      return clone(settings);
    },
    async saveSettings(patch) {
      settings = { ...(settings || {}), ...clone(patch) };
      return clone(settings);
    },
    async getSequence() {
      return clone(sequence);
    },
    async saveSequence(steps) {
      sequence = { steps: clone(steps), updatedAt: new Date() };
      return clone(sequence);
    },
  };
}

module.exports = { createMemoryRepo };
