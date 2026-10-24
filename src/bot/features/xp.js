// نظام XP والمستويات
const { EmbedBuilder } = require('discord.js');
const storage = require('../../storage');
const { COLORS } = require('../../utils/helpers');

function levelFor(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

// يرجع مستوى جديد لو عدّى (أو null)
async function onMessage(message) {
  const botId = message.client._botId;
  const s = storage.getGuild(botId, message.guild.id);
  if (!s.xp.enabled) return;

  const now = Date.now();
  const data = s.xpData[message.author.id] || { xp: 0, last: 0 };
  if (now - data.last < s.xp.cooldownSeconds * 1000) return;

  const before = levelFor(data.xp);
  data.xp += s.xp.xpPerMessage;
  data.last = now;
  const after = levelFor(data.xp);

  storage.updateGuild(botId, message.guild.id, (st) => {
    st.xpData[message.author.id] = data;
    // تنظيف: لو البيانات كبرت جداً نشيل النشطين بس؟ نسيبها — JSON بيتسع
  });

  // إعلان الترقية
  if (after > before && s.xp.announceChannelId) {
    const ch = message.guild.channels.cache.get(s.xp.announceChannelId);
    if (ch?.isTextBased()) {
      ch.send({
        content: s.xp.levelUpMessage
          .replaceAll('{level}', String(after))
          .replaceAll('{user}', `<@${message.author.id}>`),
      }).catch(() => {});
    }
  }
}

function leaderboard(botId, guildId, limit = 15) {
  const s = storage.getGuild(botId, guildId);
  return Object.entries(s.xpData || {})
    .map(([userId, d]) => ({ userId, xp: d.xp, level: levelFor(d.xp) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

module.exports = { onMessage, levelFor, leaderboard };
