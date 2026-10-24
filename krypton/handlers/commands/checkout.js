// ═══════════════════════════════════════════════
//  Command: /checkout - تسجيل انصراف الستاف
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');

module.exports = {
  name: 'checkout',

  async execute(interaction, client) {
    const member = interaction.member;
    const staffRole = config.staffAttendance.staffRoleId;

    if (!member.roles.cache.has(staffRole)) {
      return interaction.reply({ content: '❌ دي ميزة للستاف فقط.', ephemeral: true });
    }

    const rec = storage.checkOut(member.id);
    if (!rec) {
      return interaction.reply({ content: '⚠️ مفيش حضور مسجل ليك النهارده. استخدم `/checkin` الأول.', ephemeral: true });
    }

    const hours = (rec.totalMs / 3600000).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle('👋 تم تسجيل الانصراف')
      .setDescription(
        `<@${member.id}> أنهى شيفته.\n\n` +
        `**إجمالي وقت العمل:** ${hours} ساعة`
      )
      .setColor(0xe67e22);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    if (config.staffAttendance.logChannelId) {
      const chan = client.channels.cache.get(config.staffAttendance.logChannelId);
      if (chan) chan.send({ embeds: [embed.setFooter({ text: 'Attendance Log' })] }).catch(() => {});
    }
  },
};