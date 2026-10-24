// ═══════════════════════════════════════════════
//  Button: ticket_open - فتح تيكت جديد
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../../config');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'ticket_open',

  async execute(interaction, client) {
    const member = interaction.member;
    const guild = interaction.guild;

    // ─── لو عنده تيكت مفتوح قبل كده (في أي كاتجوري تيكتات) ───
    const { getCategoryMap } = require('../../utils/ticketCategories');
    const catMap = getCategoryMap();
    const ticketCategoryIds = new Set(config.tickets.categories.map((c) => catMap[c.id] || c.categoryId).filter(Boolean));
    ticketCategoryIds.add(config.ids.ticketCategory);

    const openTickets = guild.channels.cache.filter(
      (ch) =>
        ticketCategoryIds.has(ch.parentId) &&
        ch.topic &&
        ch.topic.includes(member.id)
    );

    if (openTickets.size >= config.tickets.maxTicketsPerUser) {
      return interaction.reply({
        content: `❌ عندك بالفعل ${openTickets.size} تيكت مفتوح. اقفل واحد الأول.`,
        ephemeral: true,
      });
    }

    // ─── اختيار نوع التيكت ───
    const options = config.tickets.categories.map((cat) => ({
      label: cat.label,
      description: `افتح تيكت ${cat.label}`,
      value: cat.id,
      emoji: cat.emoji,
    }));

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_select_type')
        .setPlaceholder('🔽 اختر نوع التيكت')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(options)
    );

    const embed = new EmbedBuilder()
      .setTitle('🎫 فتح تيكت جديد')
      .setDescription('اختر القسم اللي محتاج المساعدة فيه من القائمة تحت.')
      .setColor(0x9b59b6)
      .setFooter({ text: 'KRYPTON • Ticket System' })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};