// ═══════════════════════════════════════════════
//  Time Utility - تحويل المدد
// ═══════════════════════════════════════════════

function parseDuration(input) {
  const match = String(input).trim().toLowerCase().match(/^(\d+)\s*(s|m|h|d|w)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return value * multipliers[unit];
}

module.exports = { parseDuration };