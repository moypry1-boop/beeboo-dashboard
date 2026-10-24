// ═══════════════════════════════════════════════
//  Command: /bill - إرسال فاتورة أنيقة للعميل عن طريق الإيميل
//  مثال: /bill email:foo@gmail.com customer:عميل items:"VIP 25, Nitro 9.99" note:"شكرا"
// ═══════════════════════════════════════════════

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const { sendMail, buildReceipt } = require('../../utils/mailer');

function parseItems(raw) {
  // "اسم:سعر" مفصولة بفاصلة  أو "اسم1$10, اسم2$5"
  const out = [];
  const parts = String(raw).split(/,|\n/);
  for (let p of parts) {
    p = p.trim();
    if (!p) continue;
    // يحاول يلاقي سعر برقم في النص
    const m = p.match(/([\d]+([.,]\d+)?)\s*$/);
    const price = m ? parseFloat(m[1].replace(',', '.')) : 0;
    const name = m ? p.slice(0, m.index).trim() : p;
    out.push({ name: name || 'منتج', qty: 1, price });
  }
  return out;
}

module.exports = {
  name: 'bill',

  defaultMemberPermissions: PermissionFlagsBits.Administrator,

  options: [
    { name: 'email', description: 'إيميل العميل', type: 3, required: true },
    { name: 'items', description: 'المنتجات: VIP 25, Nitro 9.99', type: 3, required: true },
    { name: 'customer', description: 'اسم العميل (اختياري)', type: 3, required: false },
    { name: 'total', description: 'الإجمالي لو محسبش تلقائي (اختياري)', type: 3, required: false },
    { name: 'note', description: 'ملاحظة (اختياري)', type: 3, required: false },
    { name: 'invoice', description: 'رقم الفاتورة (اختياري)', type: 3, required: false },
    { name: 'currency', description: 'العملة: $ , EGP , SAR , € ... (افتراضي $)', type: 3, required: false },
    { name: 'lang', description: 'لغة الفاتورة: ar أو en (افتراضي عربي)', type: 3, required: false },
  ],

  async execute(interaction, client) {
    if (interaction.user.id !== config.ids.ownerId && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ الإدارة بس تقدر تبعت فواتير.', ephemeral: true });
    }

    const email = interaction.options.getString('email');
    const itemsRaw = interaction.options.getString('items');
    const customer = interaction.options.getString('customer') || 'عميل كريم';
    const note = interaction.options.getString('note') || '';
    const invoiceId = interaction.options.getString('invoice') || undefined;
    const currency = interaction.options.getString('currency') || '$';
    const lang = interaction.options.getString('lang') || 'ar';

    const items = parseItems(itemsRaw);
    if (items.length === 0) {
      return interaction.reply({ content: '❌ مفيش منتجات صحيحة. مثال: `VIP 25, Nitro 9.99`', ephemeral: true });
    }

    // الإجمالي: يدوي أو محسوب
    const autoTotal = items.reduce((a, it) => a + it.qty * it.price, 0);
    const totalOpt = interaction.options.getString('total');
    const total = totalOpt ? parseFloat(totalOpt.replace(',', '.')) : autoTotal;

    const receipt = buildReceipt({ customerName: customer, items, total, invoiceId, note, currency, lang });

    await interaction.deferReply({ ephemeral: true });

    try {
      const info = await sendMail({ to: email, subject: receipt.subject, html: receipt.html, text: 'فاتورة من ' + config.gmail.fromName });

      const embed = new EmbedBuilder()
        .setTitle('✅ الفاتورة اتسلمت للعميل')
        .setDescription(
          `**الإيميل:** ${email}\n` +
          `**الاسم:** ${customer}\n` +
          `**الإجمالي:** ${currency}${total.toFixed(2)}\n` +
          `**العملة:** ${currency} | **اللغة:** ${lang === 'en' ? 'English' : 'عربي'}\n` +
          (invoiceId ? `**رقم الفاتورة:** ${invoiceId}\n` : '') +
          `**المنتجات:** ${items.map((it) => it.name).join(', ')}`
        )
        .setColor(0x2ecc71)
        .setFooter({ text: info.messageId?.split('@')[0] || 'رسالة مؤكدة' });

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      const embed = new EmbedBuilder()
        .setTitle('❌ فشل إرسال الفاتورة')
        .setDescription(`\`\`\`${e.response || e.message}\`\`\``)
        .setColor(0xe74c3c);
      return interaction.editReply({ embeds: [embed] });
    }
  },
};