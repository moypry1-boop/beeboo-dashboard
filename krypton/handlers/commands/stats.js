// ═══════════════════════════════════════════════
//  Command: /stats - إحصائيات السيرفر
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'stats',

  async execute(interaction, client) {
    const guild = interaction.guild;

    const embed = new EmbedBuilder()
      .setTitle(`📊 إحصائيات ${guild.name}`)
      .setColor(0x2ecc71)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setDescription(
        `**تاريخ الإنشاء:** <t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>\n` +
        `**الأونر:** <@${guild.ownerId}>`
      )
      .addFields(
        { name: '👥 الأعضاء', value: `${guild.memberCount}`, inline: true },
        { name: '👤 البشر', value: `${guild.members.cache.filter(m => !m.user.bot).size}`, inline: true },
        { name: '🤖 البوتات', value: `${guild.members.cache.filter(m => m.user.bot).size}`, inline: true },
        { name: '💬 الرومات', value: `${guild.channels.cache.size}`, inline: true },
        { name: '🏷️ الرولات', value: `${guild.roles.cache.size}`, inline: true },
        { name: '📈 Level Boost', value: `${guild.premiumTier || 0}`, inline: true }
      )
      .setFooter({ text: `KRYPTON Bot • ${client.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};