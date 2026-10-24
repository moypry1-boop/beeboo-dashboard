// ═══════════════════════════════════════════════
//  Command: /download - إنزال محتوى/سكريبت كملف منسّق في روم
//  تكتب title + desc + content + تختار channel
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');
const { createFileFromContent } = require('../../utils/downloads');
const { isAdmin } = require('../../utils/permissions');

module.exports = {
  name: 'download',

  async execute(interaction, client) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للأدمن فقط.', ephemeral: true });
    }

    const title = interaction.options.getString('title') || '';
    const desc = interaction.options.getString('desc') || '';
    const content = interaction.options.getString('content') || '';
    const format = interaction.options.getString('format') || 'html';
    // الروم المحدد (اختيارك)، أو الروم الحالي لو متحددش
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!content.trim()) {
      return interaction.reply({ content: '❌ لازم تكتب محتوى/content.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // نصيحة: نبني المحتوى بمساعدة المستخدم - خليني أعمل الملف من الـ data دي مباشرة
    const msgContent = buildRaw({ title, desc, content, format });

    try {
      const result = await createFileFromContent(msgContent);
      const file = new AttachmentBuilder(result.filePath, { name: result.filename });

      // رسالة توضيحية أنيقة فوق الملف في الروم المختار
      const embed = new EmbedBuilder()
        .setTitle(`📦 ${title}`)
        .setDescription(desc || 'تنزيل ملف')
        .addFields(
          { name: '📄 Format', value: result.format.toUpperCase(), inline: true },
          { name: '📦 File', value: `\`${result.filename}\``, inline: true }
        )
        .setColor(0x29b9f2)
        .setFooter({ text: 'KRYPTON • Download' })
        .setTimestamp();

      if (targetChannel.isTextBased()) {
        await targetChannel.send({ embeds: [embed], files: [file] });
        return interaction.editReply({
          content: `✅ تم إنزال الملف **${result.filename}** في <#${targetChannel.id}>`,
        });
      }

      // لو الروم مش نصي
      return interaction.editReply({
        content: `❌ ${targetChannel.name} مش روم نصي، اختر روم كتابة.`,
      });
    } catch (err) {
      console.error('[Download] error:', err);
      return interaction.editReply({ content: `❌ حصل خطأ: ${err.message}` });
    }
  },
};

// ─── بناء النص الخام بالصيغة اللي يفهمها createFileFromContent ───
function buildRaw({ title, desc, content, format }) {
  return [
    `title: ${title}`,
    desc ? `desc: ${desc}` : '',
    format ? `format: ${format}` : '',
    'content:',
    content,
  ].filter(Boolean).join('\n');
}
