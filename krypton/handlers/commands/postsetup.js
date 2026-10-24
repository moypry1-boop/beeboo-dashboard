// ═══════════════════════════════════════════════
//  Command: /postsetup - إنشاء روم بوستات خاص للباستر
// ═══════════════════════════════════════════════

const { EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');

module.exports = {
  name: 'postsetup',

  defaultMemberPermissions: PermissionFlagsBits.ManageChannels,

  async execute(interaction, client) {
    if (interaction.user.id !== config.ids.ownerId) {
      return interaction.reply({ content: '❌ المالك بس يقدر يفتح روم بوستات.', ephemeral: true });
    }

    if (!config.posts.enabled) {
      return interaction.reply({ content: '❌ نظام البوستات متوقف.', ephemeral: true });
    }

    const catId = config.posts.postsCategoryId;
    const category = catId ? interaction.guild.channels.cache.get(catId) : null;

    const existing = storage.getPostInfo(interaction.user.id);
    if (existing.channelId) {
      return interaction.reply({
        content: `⚠️ عندك روم بوستات موجود بالفعل: <#${existing.channelId}>`,
        ephemeral: true,
      });
    }

    // عدد الرومات النشطة
    const activeChannels = storage.countActivePostChannels();
    if (activeChannels >= config.posts.maxActivePosts) {
      return interaction.reply({
        content: `❌ وصلت للحد الأقصى (${config.posts.maxActivePosts}) لرومات البوستات النشطة.`,
        ephemeral: true,
      });
    }

    // إنشاء الروم
    try {
      const channel = await interaction.guild.channels.create({
        name: `📦-posts-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}`,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
        ],
      });

      storage.setPostChannel(interaction.user.id, channel.id);

      const embed = new EmbedBuilder()
        .setTitle('📣 روم بوستاتك جاهز!')
        .setDescription(
          `اتعمل ليك روم خاص: <#${channel.id}>\n\n` +
          `اكتب فيه مسوداتك، وبعد لما تجهز اضغط:\n` +
          `**/post** عشان تنشره في روم البوستات العام.`
        )
        .setColor(0x9b59b6);

      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ اتعمل رومك: <#${channel.id}>`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `❌ حصل خطأ: ${e.message}`, ephemeral: true });
    }
  },
};