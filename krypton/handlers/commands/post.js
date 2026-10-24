// ═══════════════════════════════════════════════
//  Command: /post - نشر بوستك في روم البوستات العام
// ═══════════════════════════════════════════════

const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');

module.exports = {
  name: 'post',

  async execute(interaction, client) {
    if (!config.posts.enabled) {
      return interaction.reply({ content: '❌ نظام البوستات متوقف.', ephemeral: true });
    }

    const info = storage.getPostInfo(interaction.user.id);
    if (!info.channelId || info.channelId !== interaction.channel.id) {
      return interaction.reply({
        content: `❌ مينفعش تنشر من هنا. روح لروم البوستات الخاص بيك.`,
        ephemeral: true,
      });
    }

    // ─── حماية الاي بتات ───
    const lastPost = info.lastPostAt;
    const cooldownMs = 10 * 60 * 1000; // 10 دقايق
    if (lastPost && Date.now() - lastPost < cooldownMs) {
      const waitMin = Math.ceil((cooldownMs - (Date.now() - lastPost)) / 60000);
      return interaction.reply({ content: `⏳ خلصت بوستك قريب. استنى **${waitMin} دقيقة** قبل ما تنشر تاني.`, ephemeral: true });
    }

    // ─── نجيب أحدث رسالة من الروم (مسودة البوست) ───
    let content = '';
    let attachments = [];
    try {
      const msgs = await interaction.channel.messages.fetch({ limit: 20 });
      // نلاقي أحدث رسالة مش من البوت ومش أمر /postsetup
      const latest = msgs.filter((m) => !m.author.bot && !m.content.startsWith('/')).first();
      if (latest) {
        content = latest.content;
        attachments = [...latest.attachments.values()];
      } else {
        return interaction.reply({ content: '❌ مفيش رسالة بوست في رومك. اكتب البوست الأول.', ephemeral: true });
      }
    } catch (e) {
      return interaction.reply({ content: `❌ حصل خطأ: ${e.message}`, ephemeral: true });
    }

    if (!content && attachments.length === 0) {
      return interaction.reply({ content: '❌ البوست مفيش فيه نص ولا مرفقات.', ephemeral: true });
    }

    // ─── النشر في الروم العام ───
    const postsChan = client.channels.cache.get(config.posts.postsChannel);
    if (!postsChan) {
      return interaction.reply({ content: '❌ روم البوستات العام مش موجود.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setDescription(content)
      .setColor(0x9b59b6)
      .setTimestamp();

    if (attachments.length) {
      embed.setImage(attachments[0].url);
    }

    await postsChan.send({ embeds: [embed] });
    storage.incrementPost(interaction.user.id);

    return interaction.reply({
      content: `✅ تم نشر بوستك في <#${postsChan.id}>! (عدد بوستاتك: ${storage.getPostInfo(interaction.user.id).totalPosts})`,
      ephemeral: true,
    });
  },
};