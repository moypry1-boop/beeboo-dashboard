// ═══════════════════════════════════════════════
//  Command: /level - مستوى العضو
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

function progressBar(current, needed, length = 15) {
  const filled = Math.round((current / needed) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

module.exports = {
  name: 'level',

  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const info = storage.getXp(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(`📈 مستوى ${targetUser.username}`)
      .setColor(0x5865f2)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `**الليفل:** ${info.level}\n\n` +
        `${progressBar(info.currentXp, info.needed)}\n` +
        `**XP:** ${info.currentXp} / ${info.needed}\n` +
        `**إجمالي XP:** ${info.totalXp}`
      )
      .setFooter({ text: 'KRYPTON • Leveling System' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};