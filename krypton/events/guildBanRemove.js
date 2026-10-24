// ═══════════════════════════════════════════════
//  Event: guildBanRemove - unbanned
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');

module.exports = {
  name: 'guildBanRemove',
  once: false,

  async execute(ban, client) {
    logger.success('✅ Member Unbanned', `**${ban.user.tag}** has been unbanned.`, {
      fields: [
        { name: 'User', value: `<@${ban.user.id}> (${ban.user.id})` },
        { name: 'Moderator', value: ban.executor ? `<@${ban.executor.id}>` : 'Unknown' },
      ],
    });
  },
};
