// ═══════════════════════════════════════════════
//  Button: ticket_close - قفل التيكت
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'ticket_close',

  async execute(interaction, client) {
    const channel = interaction.channel;

    // ─── السماح للمالك أو الإدارة فقط ───
    const ownerId = channel.topic && channel.topic.includes('Owner:')
      ? channel.topic.split('Owner: ')[1].trim()
      : null;

    if (interaction.user.id !== ownerId && !isStaff(interaction.member)) {
      return interaction.reply({
        content: '❌ أنت مش مالك التيكت ولسا مش من الإدارة.',
        ephemeral: true,
      });
    }

    // ─── تأكيد القفل ───
    const confirmEmbed = new EmbedBuilder()
      .setTitle('🔒 هل أنت متأكد؟')
      .setDescription('تأكيد إغلاق هذا التيكت. سيتم حذف الروم بعد 5 ثواني.')
      .setColor(0xe74c3c);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_close_confirm')
        .setLabel('✅ نعم، اقفل')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('ticket_close_cancel')
        .setLabel('❌ إلغاء')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({
      embeds: [confirmEmbed],
      components: [confirmRow],
      ephemeral: true,
    });
  },
};