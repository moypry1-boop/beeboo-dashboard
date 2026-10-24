// ═══════════════════════════════════════════════
//  Command: /help - أوامر البوت
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'help',

  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle('📖 KRYPTON Bot - الأوامر')
      .setColor(0x3498db)
      .setDescription('دي كل أوامر البوت المتاحة.')
      .setFooter({ text: 'KRYPTON', iconURL: interaction.guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    embed.addFields(
      {
        name: '🎫 نظام التيكت',
        value:
          '`/ticket close` — قفل التيكت\n' +
          '`/ticket add` — إضافة عضو للتيكت\n' +
          '`/ticket remove` — إزالة عضو من التيكت\n' +
          '`/ticket rename` — تغيير اسم التيكت',
        inline: false,
      }
    );

    if (isStaff(interaction.member)) {
      embed.addFields(
        {
          name: '🛡️ أوامر المودريشن',
          value:
            '`/kick` — كيك عضو\n' +
            '`/ban` — بان عضو\n' +
            '`/unban` — فك البان\n' +
            '`/mute` — مكت عضو\n' +
            '`/unmute` — فك المكت\n' +
            '`/clear` — مسح رسايل',
          inline: false,
        },
        {
          name: '⚙️ أوامر الإعداد',
          value:
            '`/send-verify` — رسالة الـ Verify\n' +
            '`/send-ticket` — رسالة فتح التيكت',
          inline: false,
        }
      );
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};