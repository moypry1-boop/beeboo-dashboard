// ═══════════════════════════════════════════════
//  Event: messageDelete - لوج حذف رسالة
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  once: false,

  async execute(message, client) {
    if (message.author && message.author.bot) return;
    if (!message.guild) return;

    logger.warning('🚮 Message Deleted', 'A message was deleted.', {
      fields: [
        { name: 'Author', value: message.author ? `<@${message.author.id}>` : 'Unknown' },
        { name: 'Channel', value: `<#${message.channelId}>` },
        { name: 'Content', value: message.content ? message.content.slice(0, 1000) : '[No content / embed]' },
      ],
    });
  },
};