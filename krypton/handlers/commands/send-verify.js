// ═══════════════════════════════════════════════
//  Command: /send-verify - رسالة الـ Verify
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'send-verify',

  async execute(interaction, client) {
    const channel = interaction.channel;

    const embed = new EmbedBuilder()
      .setTitle('🔐 Verification')
      .setDescription(
        '**أهلاً بيك في KRYPTON!** 🛡️\n\n' +
        'قبل ما تدخل السيرفر، اضغط على زر **Verify** تحت.\n' +
        'كده بتتأكد إنك مش بوت وبتاخد رول العضو.'
      )
      .setColor(0x1abc9c)
      .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'KRYPTON • Verify to continue' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('✅ Verify')
        .setStyle(ButtonStyle.Success)
    );

    await channel.send({ embeds: [embed], components: [row] });

    return interaction.reply({
      content: '✅ تم إرسال رسالة الـ Verify بنجاح!',
      ephemeral: true,
    });
  },
};