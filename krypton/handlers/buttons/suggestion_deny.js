// ═══════════════════════════════════════════════
//  Button: suggestion_deny - رفض الاقتراح
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'suggestion_deny',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: '❌ الأزرار دي للإدارة فقط.',
        ephemeral: true,
      });
    }

    const message = interaction.message;
    const suggestion = message.embeds[0];
    const suggestionData = storage.getSuggestion(message.id);

    if (suggestionData && suggestionData.status === 'denied') {
      return interaction.reply({ content: '⚠️ الاقتراح ده اترفض قبل كده.', ephemeral: true });
    }

    const embed = EmbedBuilder.from(suggestion)
      .setColor(0xe74c3c)
      .setFooter({ text: `Status: Denied ❌ • By ${interaction.user.tag}` });

    await message.edit({ embeds: [embed] });

    if (suggestionData) storage.updateSuggestion(message.id, 'denied');

    logger.warning('❌ Suggestion Denied', `**${interaction.user.tag}** denied a suggestion.`, {
      fields: [
        { name: 'Suggestion Author', value: `<@${suggestionData?.authorId || 'ك'}>` },
        { name: 'Content', value: suggestion.description.slice(0, 300) },
      ],
    });

    return interaction.reply({
      content: '❌ تم رفض الاقتراح.',
      ephemeral: true,
    });
  },
};