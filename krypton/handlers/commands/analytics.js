// ═══════════════════════════════════════════════
//  Command: /analytics - إحصائيات النشاط
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  name: 'analytics',

  async execute(interaction, client) {
    const analytics = storage.getAnalytics(7);
    const guild = interaction.guild;

    // ─── ترتيب المستخدمين ───
    const topUsers = Object.entries(analytics.users)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topChannels = Object.entries(analytics.channels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    let userLines = 'مفيش بيانات كفاية بعد.';
    if (topUsers.length > 0) {
      userLines = await Promise.all(topUsers.map(async ([id, n], i) => {
        let name = id;
        try { const u = await client.users.fetch(id); name = u.username; } catch {}
        return `${['🥇','🥈','🥉'][i] || `${i+1}.`} **${name}** — ${n} رسالة`;
      })).then(lines => lines.join('\n'));
    }

    let channelLines = 'مفيش بيانات.';
    if (topChannels.length > 0) {
      channelLines = topChannels.map(([id, n], i) =>
        `**${i+1}.** <#${id}> — ${n} رسالة`
      ).join('\n');
    }

    const embed = new EmbedBuilder()
      .setTitle('📈 إحصائيات الأسبوع')
      .setColor(0x3498db)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '📊 إجمالي الرسائل', value: `${analytics.total}`, inline: true },
        { name: '👥 الأعضاء الفعّالين', value: `${Object.keys(analytics.users).length}`, inline: true },
        { name: '💬 الرومات النشطة', value: `${Object.keys(analytics.channels).length}`, inline: true },
        { name: '🏆 أكثر الأعضاء نشاطًا', value: userLines, inline: false },
        { name: '📢 أكثر الرومات نشاطًا', value: channelLines, inline: false }
      )
      .setFooter({ text: 'آخر 7 أيام' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};