// ═══════════════════════════════════════════════
//  Command: /mute - مكت عضو
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'mute',

  async execute(interaction, client) {
    const target = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.reply({ content: '❌ العضو مش موجود.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ ماتمكتش نفسك.', ephemeral: true });

    const duration = minutes * 60 * 1000;
    if (!target.moderatable) return interaction.reply({ content: '❌ مش قادر أعمل مكت للعضو ده.', ephemeral: true });

    await target.timeout(duration, reason);

    logger.mod('🔇 Member Timed Out', `**${target.user.tag}** was timed out.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
        { name: 'Duration', value: `${minutes} دقايق` },
        { name: 'Reason', value: reason },
      ],
    });

    return interaction.reply({
      content: `✅ تم عمل مكت لـ **${target.user.tag}** لمدة **${minutes}** دقيقة\n**السبب:** ${reason}`,
    });
  },
};