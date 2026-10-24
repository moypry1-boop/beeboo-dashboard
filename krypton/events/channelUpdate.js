// ═══════════════════════════════════════════════
//  Event: channelUpdate - لوج تعديل الرومات
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { snapshotChannel } = require('../utils/antinuke');

module.exports = {
  name: 'channelUpdate',
  once: false,

  async execute(oldChannel, newChannel, client) {
    snapshotChannel(newChannel);
    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push(`Name: **${oldChannel.name}** → **${newChannel.name}**`);
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      changes.push('Category changed');
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push('Topic changed');
    }
    if (oldChannel.permissionOverwrites.size !== newChannel.permissionOverwrites.size) {
      changes.push('Permissions changed');
    }

    if (changes.length === 0) return;

    logger.warning('✏️ Channel Updated', `Channel **#${newChannel.name}** was modified.`, {
      fields: [
        { name: 'Changes', value: changes.join('\n') },
      ],
    });
  },
};