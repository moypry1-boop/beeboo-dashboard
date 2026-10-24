// ═══════════════════════════════════════════════
//  Event: channelDelete - لوج حذف روم + rollback + حماية
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { hit, isExempt, punish, rollbackChannel, getChannelSnapshot, restoreChannelFromBackup } = require('../utils/antinuke');
const config = require('../config');
module.exports = {
  name: 'channelDelete',
  once: false,

  async execute(channel, client) {
    logger.danger('🗑️ Channel Deleted', `Channel **#${channel.name}** was deleted.`, {
      fields: [
        { name: 'Channel Name', value: channel.name },
        { name: 'Type', value: `${channel.type}` },
      ],
    });

    if (!config.antinuke.enabled) return;

    // من عمل الحذف؟
    const audit = await channel.guild.fetchAuditLogs({ type: 12, limit: 1 }).catch(() => null);
    let executorId = null;
    if (audit) {
      const entry = audit.entries.first();
      if (entry) executorId = entry.executor?.id;
    }

    // Rollback: أولاً من الـ snapshot، لو مفيش يرجع للـ backup
    const snap = getChannelSnapshot(channel.id);
    if (config.antinuke.rollback.channels) {
      if (snap) {
        await rollbackChannel(channel.guild, snap);
      } else {
        // fallback: استرجاع من آخر backup محفوظ
        await restoreChannelFromBackup(channel.guild, channel.id);
      }
    }

    // عقوبة لو حذف كتير
    if (executorId) {
      const member = channel.guild.members.cache.get(executorId);
      if (member && !isExempt(member) && hit(executorId, 'channelDelete', config.antinuke.banChannelDelete)) {
        await punish(member, 'channelDelete (flood)', client, { reason: 'حذف رومات بسرعة' });
      }
    }
  },
};