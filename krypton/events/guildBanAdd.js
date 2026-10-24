// ═══════════════════════════════════════════════
//  Event: guildBanAdd - بن
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { hit, isExempt, punish } = require('../utils/antinuke');
const config = require('../config');

module.exports = {
  name: 'guildBanAdd',
  once: false,

  async execute(ban, client) {
    logger.danger('🔨 Member Banned', `**${ban.user.tag}** has been banned.`, {
      fields: [
        { name: 'User', value: `<@${ban.user.id}> (${ban.user.id})` },
        { name: 'Reason', value: ban.reason || 'No reason provided' },
        { name: 'Moderator', value: ban.executor ? `<@${ban.executor.id}>` : 'Unknown' },
      ],
    });

    if (!config.antinuke.enabled) return;
    const executor = ban.executor;
    if (!executor || executor.bot) return;
    if (executor.id === ban.guild.ownerId) return;
    if (config.ids.ownerId && config.ids.ownerId !== 'OWNER_USER_ID_HERE' && executor.id === config.ids.ownerId) return;

    // ثريد البان بمعظم
    if (hit(executor.id, 'guildBanAdd', config.antinuke.banBanThread)) {
      const member = ban.guild.members.cache.get(executor.id);
      if (!isExempt(member)) {
        await punish(member, 'guildBanAdd (flood)', client, { reason: 'بان بمعظم' });
      }
    }
  },
};
