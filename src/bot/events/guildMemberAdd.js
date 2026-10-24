const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const storage = require('../../storage');
const { COLORS, logEvent, punish, fillPlaceholders, baseEmbed } = require('../../utils/helpers');
const stats = require('../features/stats');
const welcomeImage = require('../features/welcomeImage');

module.exports = async function (member) {
  const guild = member.guild;
  const client = member.client;
  const s = storage.getGuild(client._botId, guild.id);

  // الإحصائيات
  stats.bump(client._botId, guild.id, 'joinsToday');

  // ===== الحماية من الرايد =====
  const raidCfg = s.protection.antiRaid;
  if (raidCfg.enabled && !member.user.bot) {
    const now = Date.now();
    let joins = client.raidTracker.get(guild.id) || [];
    joins = joins.filter((t) => now - t < Math.max(raidCfg.perMinutes, 1) * 60 * 1000);
    joins.push(now);
    client.raidTracker.set(guild.id, joins);

    const activeUntil = client.raidModeUntil.get(guild.id) || 0;
    const exceeded = joins.length >= raidCfg.maxJoins;

    if (exceeded) {
      client.raidModeUntil.set(guild.id, now + 5 * 60 * 1000); // وضع الريد شغال 5 دقايق
      console.log(`[ANTI-RAID] وضع الريد اتشغل في ${guild.name}`);
    }

    if (exceeded || now < activeUntil) {
      if (raidCfg.action === 'kick' || raidCfg.action === 'ban') {
        await punish(guild, member, raidCfg.action, 'Anti-Raid: انضمام مشبوه');
      }
      logEvent(
        guild,
        'joins',
        baseEmbed(COLORS.bad)
          .setTitle('🚨 الحماية من الرايد')
          .setDescription(`تم التعامل مع **${member.user.tag}** (${raidCfg.action})\nالانضمامات: **${joins.length}/${raidCfg.maxJoins}**`)
      );
      return; // مفيش ترحيب وقت الريد
    }
  }

  // ===== السجل: دخول عضو =====
  logEvent(
    guild,
    'joins',
    baseEmbed(COLORS.info)
      .setAuthor({ name: '📥 دخول عضو' })
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`**${member.user.tag}** دخل السيرفر\n🆔 \`${member.id}\`\n👥 العدد الآن: **${guild.memberCount}**`)
  );

  // ===== الترحيب =====
  const w = s.welcome;
  if (w.enabled && w.channelId) {
    const ch = guild.channels.cache.get(w.channelId);
    if (ch && ch.isTextBased()) {
      const text = fillPlaceholders(w.message, member);
      const files = [];
      let embed = new EmbedBuilder()
        .setColor(COLORS.main)
        .setDescription(text)
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: `أهلاً بك ${member.user.username}` })
        .setTimestamp();
      if (s.welcomeImage.enabled) {
        try {
          const buf = await welcomeImage.renderWelcome(member, s.welcomeImage);
          files.push(new AttachmentBuilder(buf, { name: 'welcome.png' }));
          embed = embed.setImage('attachment://welcome.png');
        } catch { /* فشل الرسم — نكمّل عادي */ }
      }
      if (w.embed) {
        ch.send({ embeds: [embed], files }).catch(() => {});
      } else {
        ch.send({ content: text, files }).catch(() => {});
      }
    }
  }

  // ===== رسالة DM ترحيبية =====
  if (w.dmEnabled && w.dmMessage) {
    member.send(fillPlaceholders(w.dmMessage, member)).catch(() => {});
  }

  // ===== الرتبة التلقائية =====
  const ar = s.autoRole;
  if (ar.enabled && ar.roleId) {
    const role = guild.roles.cache.get(ar.roleId);
    if (role && role.editable) member.roles.add(role).catch(() => {});
  }
};
