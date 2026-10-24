// ═══════════════════════════════════════════════
//  Event: messageUpdate - لوج تعديل رسالة
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  once: false,

  async execute(oldMessage, newMessage, client) {
    if (newMessage.author && newMessage.author.bot) return;
    if (!newMessage.guild) return;
    if (oldMessage.content === newMessage.content) return;

    logger.warning('✏️ Message Edited', 'A message was edited.', {
      fields: [
        { name: 'Author', value: `<@${newMessage.author.id}>` },
        { name: 'Channel', value: `<#${newMessage.channelId}>` },
        { name: 'Old Content', value: oldMessage.content ? oldMessage.content.slice(0, 1000) : '[Empty]' },
        { name: 'New Content', value: newMessage.content ? newMessage.content.slice(0, 1000) : '[Empty]' },
      ],
    });
  },
};