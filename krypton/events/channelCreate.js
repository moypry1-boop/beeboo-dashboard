// ═══════════════════════════════════════════════
//  Event: channelCreate - لوج + حماية الرومات
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { checkRateLimit, punishUser } = require('../utils/protection');
const { hit, isExempt, punish, snapshotChannel } = require('../utils/antinuke');
const config = require('../config');
module.exports = {
  name: 'channelCreate',
  once: false,

  async execute(channel, client) {
    snapshotChannel(channel);
    // لوج
    logger.info('📢 Channel Created', `Channel **#${channel.name}** was created.`, {
      fields: [
        { name: 'Channel', value: `<#${channel.id}>` },
        { name: 'Type', value: `${channel.type}` },
      ],
    });

    // حماية: لو أكتر من 5 رومات اتعملت في 10 ثواني
    const audit = await channel.guild.fetchAuditLogs({ type: 5, limit: 1 }).catch(() => null);
    if (audit) {
      const entry = audit.entries.first();
      if (entry && entry.executor && !entry.executor.bot) {
        const member = channel.guild.members.cache.get(entry.executor.id);
        // Anti-Nuke متقدم
        if (config.antinuke.enabled && !isExempt(member)) {
          if (hit(entry.executor.id, 'channelCreate', config.antinuke.banChannelCreate)) {
            await punish(member, 'channelCreate (flood)', client, { reason: 'إنشاء رومات بسرعة' });
          }
        }
        const result = checkRateLimit(entry.executor.id, 'channelCreate', config.protection.maxChannelCreates);
        if (result.limited) {
          logger.security('🛡️ RATE LIMIT', `**${entry.executor.tag}** creating channels too fast!`, {
            fields: [
              { name: 'User', value: `<@${entry.executor.id}>` },
              { name: 'Count', value: `${result.count} channels in window` },
            ],
          });
          if (!isExempt(member)) {
            await punish(member, 'channelCreate (rate limit)', client, { reason: 'إنشاء رومات بسرعة' });
          }
        }
      }
    }
  },
};
