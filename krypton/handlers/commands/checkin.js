// ═══════════════════════════════════════════════
//  Command: /checkin - تسجيل حضور الستاف
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');

module.exports = {
  name: 'checkin',

  async execute(interaction, client) {
    const member = interaction.member;
    const staffRole = config.staffAttendance.staffRoleId;

    if (!member.roles.cache.has(staffRole)) {
      return interaction.reply({ content: '❌ دي ميزة للستاف فقط.', ephemeral: true });
    }

    if (storage.isCheckedIn(member.id)) {
      return interaction.reply({ content: '⚠️ انت مسجل حضور بالفعل! استخدم `/checkout` للانصراف.', ephemeral: true });
    }

    storage.checkIn(member.id);

    const embed = new EmbedBuilder()
      .setTitle('✅ تم تسجيل الحضور')
      .setDescription(`<@${member.id}> بدأ شيفته دلوقتي.\n\n**وقت الحضور:** <t:${Math.floor(Date.now() / 1000)}:t>`)
      .setColor(0x2ecc71);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // سجل في اللوجات
    if (config.staffAttendance.logChannelId) {
      const chan = client.channels.cache.get(config.staffAttendance.logChannelId);
      if (chan) chan.send({ embeds: [embed.setFooter({ text: 'Attendance Log' })] }).catch(() => {});
    }
  },
};