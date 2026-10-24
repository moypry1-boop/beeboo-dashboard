// ═══════════════════════════════════════════════
//  Command: /clearwarns - مسح تحذيرات عضو
// ═══════════════════════════════════════════════

const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'clearwarns',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للإدارة فقط.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    storage.clearWarnings(target.id);

    logger.info('🧹 Warnings Cleared', `**${interaction.user.tag}** cleared **${target.tag}**'s warnings.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Cleared By', value: `<@${interaction.user.id}>` },
      ],
    });

    return interaction.reply({
      content: `✅ تم مسح كل تحذيرات **${target.tag}**.`,
    });
  },
};