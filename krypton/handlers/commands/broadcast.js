// ═══════════════════════════════════════════════
//  Command: /broadcast - بث رسالة للأعضاء أو الرومات
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'broadcast',

  async execute(interaction, client) {
    const message = interaction.options.getString('message');
    const roleOpt = interaction.options.getRole('role');
    const channelOpt = interaction.options.getChannel('channel');

    // ─── لو اختار رول => DM للأعضاء ───
    if (roleOpt) {
      await interaction.reply({ content: '📤 جاري إرسال الرسالة للأعضاء...', ephemeral: true });

      const members = await interaction.guild.members.fetch();
      const targets = members.filter(
        m => !m.user.bot && m.roles.cache.has(roleOpt.id)
      ).first(150);

      let sent = 0;
      const embed = new EmbedBuilder()
        .setTitle('📢 إعلان من الإدارة')
        .setDescription(message)
        .setColor(0x3498db)
        .setFooter({ text: `KRYPTON • ${interaction.user.tag}` })
        .setTimestamp();

      for (const member of targets) {
        await member.send({ embeds: [embed] }).catch(() => {});
        sent++;
        await new Promise(r => setTimeout(r, 750)); // نفس الريت ليمت
      }

      logger.info('📢 Broadcast', `**${interaction.user.tag}** broadcast to **${roleOpt.name}** role.`, {
        fields: [
          { name: 'Role', value: roleOpt.name },
          { name: 'Delivered', value: `${sent} members` },
        ],
      });

      return interaction.editReply({
        content: `✅ تم إرسال الإعلان لـ **${sent}** عضو من رول **${roleOpt.name}**.`,
      });
    }

    // ─── غير كده => روم محدد ───
    const targetChannel = channelOpt || interaction.channel;
    const embed = new EmbedBuilder()
      .setTitle('📢 إعلان من الإدارة')
      .setDescription(message)
      .setColor(0x5865f2)
      .setFooter({ text: `KRYPTON • ${interaction.user.tag}` })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });

    logger.info('📢 Announcement', `**${interaction.user.tag}** posted an announcement in #${targetChannel.name}.`, {
      fields: [
        { name: 'Channel', value: `<#${targetChannel.id}>` },
        { name: 'Message', value: message.slice(0, 500) },
      ],
    });

    return interaction.reply({
      content: `✅ تم نشر الإعلان في ${targetChannel}`,
      ephemeral: true,
    });
  },
};