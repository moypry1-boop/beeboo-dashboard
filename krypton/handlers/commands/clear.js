// ═══════════════════════════════════════════════
//  Command: /clear - مسح الرسايل
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'clear',

  async execute(interaction, client) {
    const amount = interaction.options.getInteger('amount');

    if (amount < 1 || amount > 100) {
      return interaction.reply({ content: '❌ العدد لازم يكون من 1 لـ 100.', ephemeral: true });
    }

    const messages = await interaction.channel.bulkDelete(amount, true);

    logger.mod('🧹 Messages Cleared', `**${interaction.user.tag}** cleared ${messages.size} messages.`, {
      fields: [
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
        { name: 'Channel', value: `<#${interaction.channel.id}>` },
        { name: 'Amount', value: `${messages.size}` },
      ],
    });

    await interaction.reply({
      content: `✅ تم مسح **${messages.size}** رسالة.`,
      ephemeral: true,
    });
  },
};