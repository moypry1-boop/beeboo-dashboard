// ═══════════════════════════════════════════════
//  Button: ticket_claim - الإستلام من الفريق
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'ticket_claim',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: '❌ الأزرار دي للإدارة فقط.',
        ephemeral: true,
      });
    }

    const channel = interaction.channel;

    logger.ticket('🙋 Ticket Claimed', `**${interaction.user.tag}** claimed ticket **${channel.name}**.`, {
      fields: [
        { name: 'Agent', value: `<@${interaction.user.id}>` },
        { name: 'Channel', value: `<#${channel.id}>` },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('🙋 Ticket Claimed')
      .setDescription(`**${interaction.user.tag}** من فريق الدعم هيقوم بالرد على طلبك.`)
      .setColor(0x3498db)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};