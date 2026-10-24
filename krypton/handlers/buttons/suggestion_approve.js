// ═══════════════════════════════════════════════
//  Button: suggestion_approve - موافقة الاقتراح
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'suggestion_approve',

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

    if (suggestionData && suggestionData.status === 'approved') {
      return interaction.reply({ content: '⚠️ الاقتراح ده اتعمل له موافقة قبل كده.', ephemeral: true });
    }

    const embed = EmbedBuilder.from(suggestion)
      .setColor(0x2ecc71)
      .setFooter({ text: `Status: Approved ✅ • By ${interaction.user.tag}` });

    await message.edit({ embeds: [embed] });

    if (suggestionData) storage.updateSuggestion(message.id, 'approved');

    logger.success('✅ Suggestion Approved', `**${interaction.user.tag}** approved a suggestion.`, {
      fields: [
        { name: 'Suggestion Author', value: `<@${suggestionData?.authorId || 'ك'}>` },
        { name: 'Content', value: suggestion.description.slice(0, 300) },
      ],
    });

    return interaction.reply({
      content: '✅ تمت الموافقة على الاقتراح.',
      ephemeral: true,
    });
  },
};