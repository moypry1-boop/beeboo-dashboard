// كل أحداث السجلات في ملف واحد
const { EmbedBuilder, Events, GuildMemberFlags } = require('discord.js');
const { COLORS, logEvent, baseEmbed } = require('../../utils/helpers');

module.exports = function register(client) {
  // حذف رسالة
  client.on(Events.MessageDelete, (msg) => {
    if (!msg.guild || msg.author?.bot) return;
    const desc = msg.partial
      ? 'رسالة قديمة — المحتوى مش متاح'
      : `**المحتوى:** ${String(msg.content || '*مفيش نص*').slice(0, 900)}\n**في:** <#${msg.channelId}>`;
    logEvent(msg.guild, 'messageDelete', baseEmbed(COLORS.bad)
      .setAuthor({ name: `🗑️ حذف رسالة | ${msg.author?.tag || 'غير معروف'}` })
      .setDescription(desc).setTimestamp());
  });

  // تعديل رسالة
  client.on(Events.MessageUpdate, (oldM, newM) => {
    if (!newM.guild || newM.author?.bot || newM.partial) return;
    if ((oldM.content || '') === (newM.content || '')) return;
    logEvent(newM.guild, 'messageEdit', baseEmbed(COLORS.warn)
      .setAuthor({ name: `✏️ تعديل رسالة | ${newM.author.tag}` })
      .setDescription(
        `**قبل:** ${String(oldM.content || '*فارغ*').slice(0, 500)}\n` +
        `**بعد:** ${String(newM.content || '*فارغ*').slice(0, 500)}\n` +
        `**في:** <#${newM.channelId}>`
      ).setTimestamp());
  });

  // حظر / فك حظر
  client.on(Events.GuildBanAdd, (ban) => {
    logEvent(ban.guild, 'memberBan', baseEmbed(COLORS.bad)
      .setAuthor({ name: '🔨 عضو اتحظر' })
      .setThumbnail(ban.user.displayAvatarURL())
      .setDescription(`**${ban.user.tag}** (\`${ban.user.id}\`)\nالسبب: \`${ban.reason || 'بدون سبب'}\``));
  });
  client.on(Events.GuildBanRemove, (ban) => {
    logEvent(ban.guild, 'memberBan', baseEmbed(COLORS.good)
      .setAuthor({ name: '🔓 فك حظر' })
      .setThumbnail(ban.user.displayAvatarURL())
      .setDescription(`**${ban.user.tag}** (\`${ban.user.id}\`) رجع من الحظر`));
  });

  // خروج عضو (نميّز الكيك من الخروج العادي عن طريق سجل التدقيق)
  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const audit = await member.guild.fetchAuditLogs({ type: 20 /* Kick */, limit: 5 }).catch(() => null);
      const kickEntry = audit?.entries.find((e) =>
        e.target?.id === member.id && Date.now() - e.createdTimestamp < 10000);
      if (kickEntry) {
        logEvent(member.guild, 'memberKick', baseEmbed(COLORS.bad)
          .setAuthor({ name: '👢 طرد عضو' })
          .setThumbnail(member.user.displayAvatarURL())
          .setDescription(`**${member.user.tag}** اتطرد\nبواسطة: <@${kickEntry.executorId}>\nالسبب: \`${kickEntry.reason || 'بدون سبب'}\``));
        return;
      }
    } catch { /* تجاهل */ }
    logEvent(member.guild, 'leaves', baseEmbed(COLORs_leave())
      .setAuthor({ name: '📤 خروج عضو' })
      .setThumbnail(member.user.displayAvatarURL())
      .setDescription(`**${member.user.tag}** خرج من السيرفر\n👥 العدد الآن: **${member.guild.memberCount}**`));
  });

  // تغيير النickname
  client.on(Events.GuildMemberUpdate, (oldM, newM) => {
    if (oldM.nickname === newM.nickname) return;
    logEvent(newM.guild, 'nickname', baseEmbed(COLORS.info)
      .setAuthor({ name: '📛 تغيير اللقب' })
      .setThumbnail(newM.user.displayAvatarURL())
      .setDescription(`**${newM.user.tag}**\nقبل: \`${oldM.nickname || newM.user.username}\`\nبعد: \`${newM.nickname || newM.user.username}\``));
  });

  // الرتب
  client.on(Events.RoleCreate, (role) => {
    logEvent(role.guild, 'roleChanges', baseEmbed(COLORS.good)
      .setAuthor({ name: '➕ إنشاء رتبة' }).setDescription(`الرتبة: ${role}`));
  });
  client.on(Events.RoleDelete, (role) => {
    logEvent(role.guild, 'roleChanges', baseEmbed(COLORS.bad)
      .setAuthor({ name: '❌ حذف رتبة' }).setDescription(`الاسم: \`${role.name}\``));
  });

  // القنوات
  client.on(Events.ChannelCreate, (ch) => {
    logEvent(ch.guild, 'channelChanges', baseEmbed(COLORS.good)
      .setAuthor({ name: '📁 إنشاء قناة' }).setDescription(`${ch} (\`${ch.name}\`)`));
  });
  client.on(Events.ChannelDelete, (ch) => {
    logEvent(ch.guild, 'channelChanges', baseEmbed(COLORS.bad)
      .setAuthor({ name: '🗑️ حذف قناة' }).setDescription(`\`${ch.name}\``));
  });
};

function COLORs_leave() {
  return 0x95a5a6;
}
