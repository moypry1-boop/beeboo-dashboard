// ═══════════════════════════════════════════════
//  Command: /suggest - اقتراح جديد
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'suggest',

  async execute(interaction, client) {
    const suggestion = interaction.options.getString('suggestion');
    const channel = interaction.guild.channels.cache.get(config.ids.suggestionsChannel);

    if (!channel) {
      return interaction.reply({
        content: '❌ روم الاقتراحات مش متظبط. ادّي `Suggestion Channel ID` في الـ config.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('💡 اقتراح جديد')
      .setDescription(suggestion)
      .setColor(0xf1c40f)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setFooter({ text: `Status: Pending • ID: ${interaction.user.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('suggestion_approve')
        .setLabel('✅ موافقة')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('suggestion_deny')
        .setLabel('❌ رفض')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await channel.send({ embeds: [embed], components: [row] });
    await msg.react('👍').catch(() => {});
    await msg.react('👎').catch(() => {});

    storage.setSuggestion(msg.id, interaction.user.id, 'pending');

    logger.info('💡 Suggestion', `**${interaction.user.tag}** submitted a suggestion.`, {
      fields: [
        { name: 'User', value: `<@${interaction.user.id}>` },
        { name: 'Message', value: suggestion.slice(0, 500) },
        { name: 'Channel', value: `<#${msg.channelId}>` },
      ],
    });

    return interaction.reply({
      content: `✅ تم إرسال اقتراحك: ${channel}`,
      ephemeral: true,
    });
  },
};