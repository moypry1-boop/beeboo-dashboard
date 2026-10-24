// ═══════════════════════════════════════════════
//  Command: /send-ticket - رسالة فتح التيكت
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  name: 'send-ticket',

  async execute(interaction, client) {
    const channel = interaction.channel;

    const embed = new EmbedBuilder()
      .setTitle('🎫 فتح تيكت')
      .setDescription(
        '**مرحباً بك في نظام التذاكر** 🎫\n\n' +
        'احتاج مساعدة في إيه؟ اضغط على زر **فتح تيكت** تحت واختار القسم.\n\n' +
        '**الأقسام المتاحة:**\n' +
        '🤖 **bot-script** — سكربتات البوتات\n' +
        '🌍 **gain-followers** — زيادة متابعين\n' +
        '📁 **dump-fivem** — دامب فايف إم\n' +
        '📀 **onesync** — وان سينك\n' +
        '🤝 **partners** — البرتنرز\n' +
        '📋 **تقديم إداره** — التقديم على الإدارة\n' +
        '🛠️ **حل المشاكل** — مشاكل عامة\n' +
        '❓ **استفسار** — أي استفسار'
      )
      .setColor(0x9b59b6)
      .setFooter({ text: 'KRYPTON • Ticket System' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_open')
        .setLabel('🎫 فتح تيكت')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: '✅ تم إرسال رسالة فتح التيكت بنجاح!',
      ephemeral: true,
    });
  },
};