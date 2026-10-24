// ═══════════════════════════════════════════════
//  Command: /unmute - فك المكت
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'unmute',

  async execute(interaction, client) {
    const target = interaction.options.getMember('user');

    if (!target) return interaction.reply({ content: '❌ العضو مش موجود.', ephemeral: true });

    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: '❌ العضو ده مش متكت أصلاً.', ephemeral: true });
    }

    await target.timeout(null);

    logger.success('🔊 Timeout Removed', `**${target.user.tag}** timeout was removed.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
      ],
    });

    return interaction.reply({ content: `✅ تم فك المكت عن **${target.user.tag}**.` });
  },
};