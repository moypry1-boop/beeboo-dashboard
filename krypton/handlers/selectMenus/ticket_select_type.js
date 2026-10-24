// ═══════════════════════════════════════════════
//  SelectMenu: ticket_select_type - إنشاء روم التيكت
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../../config');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'ticket_select_type',

  async execute(interaction, client) {
    const categoryType = interaction.values[0];
    const category = config.tickets.categories.find((c) => c.id === categoryType);
    if (!category) {
      return interaction.reply({
        content: '❌ قسم غير معروف.',
        ephemeral: true,
      });
    }

    const member = interaction.member;
    const guild = interaction.guild;
    // كل نوع تيكت له كاتجوري مخصوصة (categoryId من الخريطة المحفوظة أو config)
    const { getCategoryMap } = require('../../utils/ticketCategories');
    const catMap = getCategoryMap();
    const parentId = catMap[category.id] || category.categoryId || config.ids.ticketCategory;
    const categoryChannel = guild.channels.cache.get(parentId);

    // ─── لو التيكت موجود بالفعل (من نفس النوع + نفس الفئة) ───
    const existing = guild.channels.cache.find(
      (ch) =>
        ch.parentId === parentId &&
        ch.topic &&
        ch.topic.includes(member.id) &&
        ch.name.includes(member.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
    );

    if (existing) {
      return interaction.reply({
        content: `❌ عندك تيكت **${category.name}** مفتوح بالفعل: <#${existing.id}>`,
        ephemeral: true,
      });
    }

    // ─── اسم التيكت = اسم الشخص ───
    const ticketName = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

    try {
      const staffRole = guild.roles.cache.get(config.ids.staffRole);
      const adminRole = guild.roles.cache.get(config.ids.adminRole);

      // ─── بيرميشنز الروم ───
      const permissionOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ];

      // إضافة رولات الإدارة
      for (const role of [staffRole, adminRole]) {
        if (role) {
          permissionOverwrites.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          });
        }
      }

      // ─── إنشاء الروم ───
      const ticketChannel = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: categoryChannel ? categoryChannel.id : undefined,
        topic: `Ticket Type: ${category.name} | Owner: ${member.id}`,
        permissionOverwrites,
      });

      // ─── رسالة الترحيب (تصميم رسمي نظيف) ───
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.label} - Support Ticket`)
        .setDescription(
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `**👋 Hello, <@${member.id}>!**\n\n` +
          `Our support team will assist you **as soon as possible**.\n` +
          `Please describe your issue/request in detail below.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━`
        )
        .setColor(0x0f3460)
        .setFooter({ text: 'KRYPTON • Support' })
        .setTimestamp();

      const closeButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('🔒 Close Ticket')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('🙋 Claim')
          .setStyle(ButtonStyle.Primary)
      );

      await ticketChannel.send({
        embeds: [welcomeEmbed],
        components: [closeButton],
      });

      // ─── لوج التيكت ───
      logger.ticket('🎫 Ticket Created', `**${member.user.tag}** opened a **${category.label}** ticket.`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'Type', value: `${category.emoji} ${category.label}` },
          { name: 'Channel', value: `<#${ticketChannel.id}>` },
        ],
      });

      return interaction.update({
        content: `✅ تم فتح التيكت: <#${ticketChannel.id}>`,
        embeds: [],
        components: [],
        ephemeral: true,
      });
    } catch (err) {
      console.error('[Ticket] Failed to create ticket:', err);
      return interaction.reply({
        content: '❌ حصل خطأ أثناء فتح التيكت.',
        ephemeral: true,
      });
    }
  },
};