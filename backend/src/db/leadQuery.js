// Shared constants for lead statuses & ordering (used by both repositories).

const STATUSES = ['queued', 'active', 'replied', 'completed', 'stopped', 'unsubscribed', 'bounced'];
const SENDABLE = ['queued', 'active'];

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { STATUSES, SENDABLE, escapeRegex };
