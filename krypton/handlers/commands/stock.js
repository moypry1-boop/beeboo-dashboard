// ═══════════════════════════════════════════════
//  Command: /stock - عرض المخزون
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');

module.exports = {
  name: 'stock',

  async execute(interaction, client) {
    const stock = storage.getStock();
    const entries = Object.entries(stock);

    if (entries.length === 0) {
      return interaction.reply({
        content: '📭 المخزون فاضي. ضيف منتجات بـ `/addstock`.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📦 مخزون المتجر')
      .setColor(0x2ecc71);

    for (const [product, info] of entries) {
      const status = info.stock === 0 ? '🚨 **نفذ**' : `✅ ${info.stock}`;
      embed.addFields({
        name: product,
        value: `**المخزون:** ${status}${info.price ? ` | **السعر:** ${info.price}` : ''}${info.note ? `\n*${info.note}*` : ''}`,
        inline: true,
      });
    }

    return interaction.reply({ embeds: [embed] });
  },
};