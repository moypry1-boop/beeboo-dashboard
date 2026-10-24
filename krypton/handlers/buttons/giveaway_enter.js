// ═══════════════════════════════════════════════
//  Button: giveaway_enter - دخول الجيف أواي
// ═══════════════════════════════════════════════

const storage = require('../../utils/storage');
const config = require('../../config');
const { createGiveawayEmbed } = require('../../utils/giveaways');

module.exports = {
  name: 'giveaway_enter',

  async execute(interaction, client) {
    const messageId = interaction.message.id;

    // ─── رول إجباري ───
    if (config.giveaways.requireRole && !interaction.member.roles.cache.has(config.giveaways.requireRole)) {
      return interaction.reply({
        content: '❌ محتاج رول معين للمشاركة في الجيف أواي ده.',
        ephemeral: true,
      });
    }

    const result = storage.addEntrant(messageId, interaction.user.id);

    if (!result.ok) {
      return interaction.reply({
        content: result.reason === 'already' ? '🤔 انت داخل من قبل كده!' : '❌ الجيف أواي ده غير متاح.',
        ephemeral: true,
      });
    }

    // ─── تحديث عدّاد المشاركين ───
    const gw = result.gw;
    const embed = createGiveawayEmbed(gw, gw.entrants.length);
    await interaction.message.edit({ embeds: [embed] }).catch(() => {});

    return interaction.reply({
      content: '🎉 تم تسجيل دخولك في الجيف أواي! بالتوفيق 🤞',
      ephemeral: true,
    });
  },
};