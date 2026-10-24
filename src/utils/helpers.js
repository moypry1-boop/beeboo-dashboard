const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const storage = require('../storage');

const COLORS = {
  main: 0x8b5cf6,
  good: 0x2ecc71,
  bad: 0xe74c3c,
  warn: 0xf39c12,
  info: 0x3498db,
};

function baseEmbed(color = COLORS.main) {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

// إرسال لوج حسب نوع الحدث (كل بوت لإعداداته عبر client._botId)
function logEvent(guild, eventKey, embed) {
  const s = storage.getGuild(guild.client._botId, guild.id);
  if (!s.logs.enabled || !s.logs.channelId) return;
  if (s.logs.events && s.logs.events[eventKey] === false) return;
  const ch = guild.channels.cache.get(s.logs.channelId);
  if (!ch || !ch.isTextBased()) return;
  ch.send({ embeds: [embed] }).catch(() => {});
}

function sendModLog(guild, embed) {
  const s = storage.getGuild(guild.client._botId, guild.id);
  if (!s.moderation.modLogChannelId) return;
  const ch = guild.channels.cache.get(s.moderation.modLogChannelId);
  if (!ch || !ch.isTextBased()) return;
  ch.send({ embeds: [embed] }).catch(() => {});
}

// هل العضو مستثنى من الحماية؟
function isExempt(member, channelId, settings) {
  if (!member || member.user.bot) return true;
  if (member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if ((settings.whitelistChannels || []).includes(channelId)) return true;
  const wlRoles = settings.whitelistRoles || [];
  if (wlRoles.length && member.roles.cache.some((r) => wlRoles.includes(r.id))) return true;
  return false;
}

// تنفيذ العقوبة
async function punish(guild, member, action, reason) {
  try {
    switch (action) {
      case 'timeout':
        if (member.moderatable) await member.timeout(10 * 60 * 1000, reason);
        break;
      case 'kick':
        if (member.kickable) await member.kick(reason);
        break;
      case 'ban':
        if (member.bannable) await member.ban({ reason });
        break;
      default:
        break; // delete فقط
    }
  } catch (e) {
    console.error('[PUNISH]', e.message);
  }
}

function fillPlaceholders(text, memberOrGuild, extra = {}) {
  let out = text || '';
  const guild = memberOrGuild?.guild || memberOrGuild;
  const user = memberOrGuild?.user;
  out = out
    .replaceAll('{user}', user ? `<@${user.id}>` : '')
    .replaceAll('{username}', user ? user.username : '')
    .replaceAll('{server}', guild ? guild.name : '')
    .replaceAll('{memberCount}', String(guild ? guild.memberCount : ''));
  for (const [k, v] of Object.entries(extra)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

module.exports = { COLORS, baseEmbed, logEvent, sendModLog, isExempt, punish, fillPlaceholders };
