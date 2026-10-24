// ═══════════════════════════════════════════════
//  Welcome Embed Utility - رسالة الويلكم (نظيفة واحترافية)
//  Embed مرتب بدون حشو + منشن لروم الفيريفيكيشن
// ═══════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

function formatAge(days) {
  if (days >= 365) {
    const y = Math.floor(days / 365);
    return y === 1 ? '1 year' : `${y} years`;
  }
  if (days >= 30) {
    const m = Math.floor(days / 30);
    return m === 1 ? '1 month' : `${m} months`;
  }
  if (days >= 7) {
    const w = Math.floor(days / 7);
    return w === 1 ? '1 week' : `${w} weeks`;
  }
  return days === 1 ? '1 day' : `${days} days`;
}

function buildWelcomeEmbed(member, inviter) {
  const cfg = config.welcomeEmbed || {};
  const t = cfg.texts || {};
  const rulesLine = t.rulesLine || {};
  const footer = cfg.footer || {};

  // روم الفيريفيكيشن (منشن تلقائي)
  const verifyChannelId = cfg.verifyChannelId || config.ids.verifyChannel;
  const verifyMention = verifyChannelId ? `<#${verifyChannelId}>` : '**✅┃verify**';

  // بيانات إضافية (وقت الدخول + من دعى العضو)
  const joinTs = member.joinedAt ? Math.floor(member.joinedAt.getTime() / 1000) : null;
  const inviterId = inviter && inviter.inviterId ? inviter.inviterId : null;

  // ─── الوصف (إنجليزي بالكامل، سطور متلاصقة بدون فراغات) ───
  const description = [
    `👋 Welcome, <@${member.id}>`,
    `⚠️ **${rulesLine.text || "Don't Forget To Read The Rules"}** ${rulesLine.arrow || '👇'}`,
    `🚫 **No Access**`,
    `💝 **Hope To Enjoy With Us**`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🔐 Go to ${verifyMention} and press **✅ Verify** to get access.`,
    `🕐 Joined At: ${joinTs ? `<t:${joinTs}:F>` : '—'}`,
    inviterId ? `🔗 Invited By: <@${inviterId}>` : null,
  ].filter((l) => l !== null).join('\n');

  // ─── بناء الـ Embed ───
  const embed = new EmbedBuilder()
    .setTitle(cfg.title || '𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐓𝐨 𝙺𝚁𝚈𝙿𝚃𝙾𝙽')
    .setColor(cfg.color !== undefined ? cfg.color : 0x63d9ff)
    .setDescription(description)
    .setTimestamp();

  // Thumbnail: بروفايل العضو (أو رابط مخصص)
  const thumb = cfg.thumbnailURL || (member.user ? member.user.displayAvatarURL({ extension: 'png', size: 256 }) : null);
  if (thumb) embed.setThumbnail(thumb);

  // Banner
  if (cfg.bannerURL) embed.setImage(cfg.bannerURL);

  // ─── حقول معلومات (مرصّفة بجانب بعض inline) ───
  if (cfg.infoFields !== false && member.user) {
    const accountAgeMs = Date.now() - member.user.createdAt.getTime();
    const accountDays = Math.max(0, Math.floor(accountAgeMs / (1000 * 60 * 60 * 24)));
    const accountHours = Math.max(0, Math.floor(accountAgeMs / (1000 * 60 * 60)) % 24);
    embed.addFields(
      {
        name: '📅 Account Age',
        value: `**${accountDays} days ${accountHours} hours**`,
        inline: true,
      },
      {
        name: '👥 Members',
        value: `**${member.guild.memberCount}**`,
        inline: true,
      }
    );
  }

  // ─── الفوتر ───
  let footerText = '';
  if (footer.showServerName) footerText += member.guild.name;
  if (footer.season) {
    if (footerText) footerText += ' • ';
    footerText += footer.season;
  }
  if (footer.showMemberCount !== false) {
    if (footerText) footerText += ' • ';
    footerText += `👥 ${member.guild.memberCount}`;
  }
  if (footerText) {
    embed.setFooter({ text: footerText, iconURL: member.guild.iconURL({ dynamic: true }) || undefined });
  }

  // ─── الأزرار ───
  const components = [];
  const row = new ActionRowBuilder();

  if (cfg.showRulesButton !== false) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('welcome_rules')
        .setLabel('✅ Accept The Rules')
        .setStyle(ButtonStyle.Success)
    );
  }

  if (row.components.length) components.push(row);

  return { embed, components };
}

module.exports = { buildWelcomeEmbed };
