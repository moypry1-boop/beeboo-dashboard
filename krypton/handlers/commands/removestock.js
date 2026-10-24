// ═══════════════════════════════════════════════
//  Command: /removestock - خصم مخزون + تنبيه نفاذ
// ═══════════════════════════════════════════════

const config = require('../../config');
const storage = require('../../utils/storage');
const { EmbedBuilder } = require('discord.js');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'removestock',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للإدارة فقط.', ephemeral: true });
    }

    const product = interaction.options.getString('product');
    const amount = interaction.options.getInteger('amount');

    if (amount <= 0) return interaction.reply({ content: '❌ الكمية لازم تكون موجبة.', ephemeral: true });

    const result = storage.removeStock(product, amount);
    if (!result) return interaction.reply({ content: `❌ المنتج **${product}** مش موجود.`, ephemeral: true });

    logger.info('📦 Stock Removed', `**${interaction.user.tag}** removed stock from **${product}**.`, {
      fields: [
        { name: 'Product', value: product },
        { name: 'Amount Removed', value: `${amount}` },
        { name: 'Total Stock', value: `${result.stock}` },
      ],
    });

    // ─── تنبيه نفاذ المخزون ───
    if (result.stock === 0) {
      const alertCh = interaction.guild.channels.cache.get(config.stock.alertChannel);
      if (alertCh && !result.lastAlerted) {
        await alertCh.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('🚨 Out of Stock!')
              .setDescription(`المنتج **${product}** خلص المخزون!\nمحتاج إعادة تزويد.`)
              .setColor(0xe74c3c)
              .setTimestamp(),
          ],
          content: '@here',
        }).catch(() => {});
        storage.setStockAlerted(product);
      }
    }

    return interaction.reply({
      content: `✅ تم خصم **${amount}** من **${product}**\n**المخزون المتبقي:** ${result.stock}` + (result.stock === 0 ? '\n🚨 **المخزون خلص!**' : ''),
    });
  },
};