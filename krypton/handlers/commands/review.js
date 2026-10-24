// ═══════════════════════════════════════════════
//  Command: /review - مراجعة المتجر
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'review',

  async execute(interaction, client) {
    const rating = interaction.options.getInteger('rating');
    const text = interaction.options.getString('text');

    if (rating < 1 || rating > 5) {
      return interaction.reply({ content: '❌ التقييم لازم يكون من 1 لـ 5.', ephemeral: true });
    }

    // ─── كولدوان ───
    const last = storage.lastReview(interaction.user.id);
    if (last && Date.now() - last.at < config.reviews.cooldown) {
      const next = Math.ceil((config.reviews.cooldown - (Date.now() - last.at)) / 60000);
      return interaction.reply({
        content: `⏳ تقدر تراجع تاني بعد ${next} دقيقة.`,
        ephemeral: true,
      });
    }

    const channel = interaction.guild.channels.cache.get(config.ids.reviewChannel);
    if (!channel) {
      return interaction.reply({ content: '❌ روم المراجعات مش متظبط.', ephemeral: true });
    }

    const stars = '⭐'.repeat(rating) + '☆'.repeat(5 - rating);

    const embed = new EmbedBuilder()
      .setTitle('📝 مراجعة جديدة')
      .setDescription(text)
      .setColor(rating >= 4 ? 0x2ecc71 : rating >= 3 ? 0xf1c40f : 0xe74c3c)
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .addFields({ name: 'التقييم', value: `${stars} (${rating}/5)`, inline: true })
      .setFooter({ text: 'KRYPTON • Review System' })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    storage.addReview(interaction.user.id, rating, text);

    const avg = storage.averageRating();
    logger.info('📝 Review Submitted', `**${interaction.user.tag}** left a review.`, {
      fields: [
        { name: 'User', value: `<@${interaction.user.id}>` },
        { name: 'Rating', value: `${rating}/5` },
        { name: 'Average', value: avg.toFixed(1) },
      ],
    });

    return interaction.reply({
      content: `✅ تم نشر مراجعتك!\n${stars}`,
      ephemeral: true,
    });
  },
};