// MongoDB repository (official "mongodb" driver).
const { MongoClient, ObjectId } = require('mongodb');
const { SENDABLE, escapeRegex } = require('./leadQuery');

function toId(id) {
  try {
    return new ObjectId(String(id));
  } catch {
    return null;
  }
}

function out(doc) {
  if (!doc) return null;
  const { _id, leadId, ...rest } = doc;
  const res = { id: String(_id), ...rest };
  if (leadId !== undefined) res.leadId = String(leadId);
  return res;
}

async function createMongoRepo({ uri, dbName }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  const db = client.db(dbName);
  const Leads = db.collection('leads');
  const Logs = db.collection('email_logs');
  const Meta = db.collection('meta');
  const Admins = db.collection('admins');

  return {
    kind: 'mongo',
    async init() {
      await Leads.createIndex({ email: 1 }, { unique: true });
      await Leads.createIndex({ unsubToken: 1 }, { unique: true });
      await Leads.createIndex({ status: 1, nextSendAt: 1 });
      await Leads.createIndex({ messageIds: 1 });
      await Leads.createIndex({ createdAt: -1 });
      await Logs.createIndex({ leadId: 1, at: 1 });
      await Logs.createIndex({ direction: 1, status: 1, at: -1 });
      await Logs.createIndex({ messageId: 1 }, { sparse: true });
      await Admins.createIndex({ username: 1 }, { unique: true });
    },
    async close() {
      await client.close();
    },

    // ---------- leads ----------
    async insertLeads(list) {
      const inserted = [];
      const duplicates = [];
      for (const l of list) {
        try {
          const res = await Leads.insertOne({ ...l });
          inserted.push(out({ ...l, _id: res.insertedId }));
        } catch (e) {
          if (e.code === 11000) duplicates.push(l.email);
          else throw e;
        }
      }
      return { inserted, duplicates };
    },
    async listLeads({ status, q, page = 1, limit = 50 } = {}) {
      const filter = {};
      if (status) filter.status = status;
      if (q) {
        const re = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ email: re }, { name: re }, { company: re }, { city: re }];
      }
      const [items, total] = await Promise.all([
        Leads.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        Leads.countDocuments(filter),
      ]);
      return { items: items.map(out), total };
    },
    async getLead(id) {
      const _id = toId(id);
      return _id ? out(await Leads.findOne({ _id })) : null;
    },
    async getLeadByEmail(email) {
      return out(await Leads.findOne({ email: String(email).toLowerCase() }));
    },
    async getLeadByUnsubToken(token) {
      return out(await Leads.findOne({ unsubToken: String(token) }));
    },
    async getLeadByMessageIds(ids) {
      if (!ids.length) return null;
      return out(await Leads.findOne({ messageIds: { $in: ids } }));
    },
    async updateLead(id, patch) {
      const _id = toId(id);
      if (!_id) return null;
      const res = await Leads.findOneAndUpdate(
        { _id },
        { $set: { ...patch, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );
      return out(res); // mongodb driver v6 returns the updated document directly
    },
    async deleteLead(id) {
      const _id = toId(id);
      if (!_id) return false;
      const res = await Leads.deleteOne({ _id });
      await Logs.deleteMany({ leadId: _id });
      return res.deletedCount === 1;
    },
    async findNextDueLead(now) {
      const active = await Leads.find({ status: 'active', nextSendAt: { $lte: now } })
        .sort({ nextSendAt: 1, createdAt: 1 })
        .limit(1)
        .toArray();
      if (active.length) return out(active[0]);
      const queued = await Leads.find({ status: 'queued', nextSendAt: { $lte: now } })
        .sort({ nextSendAt: 1, createdAt: 1 })
        .limit(1)
        .toArray();
      return out(queued[0] || null);
    },
    async upcomingLeads(limit = 10) {
      const active = await Leads.find({ status: 'active', nextSendAt: { $ne: null } }).sort({ nextSendAt: 1 }).limit(limit).toArray();
      let items = active;
      if (items.length < limit) {
        const queued = await Leads.find({ status: 'queued', nextSendAt: { $ne: null } })
          .sort({ nextSendAt: 1, createdAt: 1 })
          .limit(limit - items.length)
          .toArray();
        items = items.concat(queued);
      }
      return items.map(out);
    },
    async countLeadsByStatus() {
      const rows = await Leads.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]).toArray();
      const res = {};
      for (const r of rows) res[r._id] = r.n;
      return res;
    },

    // ---------- logs ----------
    async addLog(log) {
      const doc = { ...log };
      if (doc.leadId) doc.leadId = toId(doc.leadId) || doc.leadId;
      const res = await Logs.insertOne(doc);
      return out({ ...doc, _id: res.insertedId });
    },
    async logExistsByMessageId(messageId) {
      return (await Logs.countDocuments({ messageId }, { limit: 1 })) > 0;
    },
    async listLogsForLead(leadId) {
      const _id = toId(leadId);
      if (!_id) return [];
      return (await Logs.find({ leadId: _id }).sort({ at: 1 }).toArray()).map(out);
    },
    async countSent(from, to) {
      const at = {};
      if (from) at.$gte = from;
      if (to) at.$lt = to;
      return Logs.countDocuments({ direction: 'out', status: 'sent', ...(from || to ? { at } : {}) });
    },
    async lastSent() {
      const rows = await Logs.find({ direction: 'out', status: 'sent' }).sort({ at: -1 }).limit(1).toArray();
      return out(rows[0] || null);
    },
    async sentBetween(from, to) {
      return (await Logs.find({ direction: 'out', status: 'sent', at: { $gte: from, $lt: to } }).sort({ at: 1 }).toArray()).map(out);
    },
    async listInbound({ kind, page = 1, limit = 50 } = {}) {
      const filter = { direction: 'in', ...(kind ? { kind } : {}) };
      const [items, total] = await Promise.all([
        Logs.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
        Logs.countDocuments(filter),
      ]);
      return { items: items.map(out), total };
    },

    // ---------- admins ----------
    async getAdmin(username) {
      const doc = await Admins.findOne({ username: String(username).toLowerCase() });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    },
    async upsertAdmin({ username, passwordHash }) {
      const now = new Date();
      const res = await Admins.updateOne(
        { username: String(username).toLowerCase() },
        { $set: { displayName: username, passwordHash, updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true }
      );
      return { created: res.upsertedCount === 1 };
    },
    async countAdmins() {
      return Admins.countDocuments({});
    },

    // ---------- settings / sequence ----------
    async getSettings() {
      const doc = await Meta.findOne({ _id: 'settings' });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      return rest;
    },
    async saveSettings(patch) {
      await Meta.updateOne({ _id: 'settings' }, { $set: patch }, { upsert: true });
      return this.getSettings();
    },
    async getSequence() {
      const doc = await Meta.findOne({ _id: 'sequence' });
      if (!doc) return null;
      return { steps: doc.steps, updatedAt: doc.updatedAt };
    },
    async saveSequence(steps) {
      await Meta.updateOne({ _id: 'sequence' }, { $set: { steps, updatedAt: new Date() } }, { upsert: true });
      return this.getSequence();
    },
  };
}

module.exports = { createMongoRepo, SENDABLE };
