// ═══════════════════════════════════════════════
//  Command: /kick - كيك عضو
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'kick',

  async execute(interaction, client) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.reply({ content: '❌ العضو مش موجود.', ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: '❌ مش قادر أكيك العضو ده.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ ماتكيكش نفسك.', ephemeral: true });

    const highest = interaction.member.roles.highest.comparePositionTo(target.roles.highest);
    if (highest <= 0) return interaction.reply({ content: '❌ مقدرش أكيك حد رتبته أعلى منك.', ephemeral: true });

    await target.kick(reason);

    logger.mod('👢 Member Kicked', `**${target.user.tag}** was kicked.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
        { name: 'Reason', value: reason },
      ],
    });

    return interaction.reply({
      content: `✅ تم كيك **${target.user.tag}**\n**السبب:** ${reason}`,
    });
  },
};