// ═══════════════════════════════════════════════
//  Command: /unban - فك البان
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'unban',

  async execute(interaction, client) {
    const user = interaction.options.getUser('user');

    try {
      await interaction.guild.members.unban(user.id);

      logger.success('✅ Member Unbanned', `**${user.tag}** was unbanned.`, {
        fields: [
          { name: 'User', value: `<@${user.id}>` },
          { name: 'Moderator', value: `<@${interaction.user.id}>` },
        ],
      });

      return interaction.reply({ content: `✅ تم فك البان عن **${user.tag}**.` });
    } catch (err) {
      return interaction.reply({ content: `❌ العضو **${user.tag}** مش متبان أصلاً.`, ephemeral: true });
    }
  },
};