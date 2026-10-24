// ═══════════════════════════════════════════════
//  Command: /addstock - إضافة مخزون لمنتج
// ═══════════════════════════════════════════════

const config = require('../../config');
const storage = require('../../utils/storage');
const { logger, } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'addstock',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للإدارة فقط.', ephemeral: true });
    }

    const product = interaction.options.getString('product');
    const amount = interaction.options.getInteger('amount');
    const price = interaction.options.getInteger('price');
    const note = interaction.options.getString('note');

    if (amount <= 0) return interaction.reply({ content: '❌ الكمية لازم تكون موجبة.', ephemeral: true });

    const result = storage.addStock(product, amount, price ?? undefined, note || undefined);

    logger.info('📦 Stock Added', `**${interaction.user.tag}** added stock to **${product}**.`, {
      fields: [
        { name: 'Product', value: product },
        { name: 'Amount Added', value: `${amount}` },
        { name: 'Total Stock', value: `${result.stock}` },
        { name: 'Price', value: result.price ? `${result.price}` : 'N/A' },
      ],
    });

    return interaction.reply({
      content: `✅ تم إضافة **+${amount}** إلى **${product}**\n**المخزون الحالي:** ${result.stock}\n**السعر:** ${result.price ? result.price : 'مش متظبط'}`,
    });
  },
};