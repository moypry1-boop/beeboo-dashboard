// ═══════════════════════════════════════════════
//  Command: /warns - سجل تحذيرات العضو
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  name: 'warns',

  async execute(interaction, client) {
    const target = interaction.options.getMember('user') || interaction.member;
    const warnings = storage.getWarnings(target.id);

    if (warnings.length === 0) {
      return interaction.reply({
        content: `✅ **${target.user.tag}** مالهوش تحذيرات.`,
        ephemeral: true,
      });
    }

    const lines = warnings.map((w, i) =>
      `**${i + 1}.** ${w.reason}\n    └ بواسطة <@${w.modId}> — <t:${Math.floor(w.at / 1000)}:R>`
    );

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ تحذيرات ${target.user.username}`)
      .setDescription(lines.join('\n\n'))
      .setColor(0xf39c12)
      .setFooter({ text: `الإجمالي: ${warnings.length}` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};