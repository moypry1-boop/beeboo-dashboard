// ═══════════════════════════════════════════════
//  Button: ticket_close_confirm - تأكيد القفل + أرشفة
// ═══════════════════════════════════════════════

const config = require('../../config');
const { logger } = require('../../utils/logger');
const { generateTranscript } = require('../../utils/transcript');

module.exports = {
  name: 'ticket_close_confirm',

  async execute(interaction, client) {
    const channel = interaction.channel;

    // ─── امسح الرد بتاع الأزرار ───
    await interaction.deferUpdate().catch(() => {});

    // ─── لوج الإغلاق ───
    logger.ticket('🔒 Ticket Closed', `Ticket **${channel.name}** was closed by **${interaction.user.tag}**.`, {
      fields: [
        { name: 'Closed By', value: `<@${interaction.user.id}>` },
        { name: 'Channel', value: `<#${channel.id}>` },
      ],
    });

    // ─── الكلام الأخير قبل الحذف ───
    try {
      await channel.send({
        embeds: [
          {
            title: '🔒 Closing Ticket',
            description: 'شكراً لاستخدامك نظام التيكت. يتم أرشفة المحادثة وحذف الروم بعد 5 ثواني...',
            color: 0xe74c3c,
          },
        ],
      });

      const archiveChannel = await interaction.guild.channels
        .fetch(config.transcripts.archiveChannel)
        .catch(() => null);

      setTimeout(async () => {
        // ─── الأرشفة ───
        if (archiveChannel) {
          try {
            const messages = await channel.messages.fetch({ limit: config.transcripts.maxMessages || 500 });
            const html = generateTranscript(channel, [...messages.values()], client);
            const { AttachmentBuilder } = require('discord.js');
            const file = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `${channel.name}-transcript.html` });
            await archiveChannel.send({
              content: `📋 أرشيف التيكت **${channel.name}** — أغلق بواسطة **${interaction.user.tag}**`,
              files: [file],
            }).catch(() => {});
          } catch (err) {
            console.error('[Transcript] Failed to archive:', err.message);
          }
        }

        await channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
      }, 5000);
    } catch (err) {
      console.error('[Ticket] Failed to close:', err.message);
    }
  },
};