// ═══════════════════════════════════════════════
//  Command: /ban - بان عضو
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'ban',

  async execute(interaction, client) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ متبانش نفسك.', ephemeral: true });

    const member = interaction.guild.members.cache.get(target.id);
    if (member && !member.bannable) return interaction.reply({ content: '❌ مش قادر أبان العضو ده.', ephemeral: true });

    await interaction.guild.members.ban(target.id, { reason });

    logger.mod('🔨 Member Banned', `**${target.tag}** was banned.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
        { name: 'Reason', value: reason },
      ],
    });

    return interaction.reply({
      content: `✅ تم بان **${target.tag}**\n**السبب:** ${reason}`,
    });
  },
};