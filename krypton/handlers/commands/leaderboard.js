// ═══════════════════════════════════════════════
//  Command: /leaderboard - متصدرين المستويات
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  name: 'leaderboard',

  async execute(interaction, client) {
    const top = storage.getLeaderboard(10);

    if (top.length === 0) {
      return interaction.reply({
        content: '📭 لسه مفيش بيانات كفاية. اكتب شوية رسايل عشان تاخد XP!',
        ephemeral: true,
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = await Promise.all(
      top.map(async (entry, i) => {
        let name = entry.id;
        try {
          const user = await client.users.fetch(entry.id);
          name = user.username;
        } catch {}
        const medal = medals[i] || `${i + 1}.`;
        return `${medal} **${name}** — Level ${entry.level} (${entry.totalXp} XP)`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle('🏆 متصدرين المستويات')
      .setDescription(lines.join('\n'))
      .setColor(0xf1c40f)
      .setFooter({ text: 'KRYPTON • Leveling System' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};