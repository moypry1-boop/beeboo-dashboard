const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const storage = require('../../storage');
const { COLORS, isExempt, punish, baseEmbed } = require('../../utils/helpers');
const { handlePrefix } = require('../slash');
const xp = require('../features/xp');
const stats = require('../features/stats');

const LINK_RE = /(https?:\/\/|www\.)[^\s]+/i;
const INVITE_RE = /(discord\.(gg|io|me|li)|discord(app)?\.com\/invite)\/?[^\s]*/i;

module.exports = async function (message) {
  if (message.author.bot || !message.guild) return;
  const client = message.client;
  const guild = message.guild;
  const member = message.member;
  const s = storage.getGuild(client._botId, guild.id);

  // الإحصائيات + XP
  stats.bump(client._botId, guild.id, 'msgsToday');
  xp.onMessage(message).catch(() => {});

  // ===== الأوامر بالبريفيكس + الأوامر المخصصة =====
  const prefix = s.prefix || '!';
  if (message.content.startsWith(prefix)) {
    await handlePrefix(message, prefix);
  }

  // ===== الحماية =====
  const p = s.protection;
  const anyProtection =
    p.antiLinks.enabled || p.antiInvites.enabled || p.badWords.enabled ||
    p.antiSpam.enabled || p.antiMention.enabled;
  if (!anyProtection) return;
  if (!member || isExempt(member, message.channel.id, s)) return;

  const content = message.content.toLowerCase();
  const reasonBase = `الحماية التلقائية في #${message.channel.name}`;

  // --- منع الدعوات ---
  if (p.antiInvites.enabled && INVITE_RE.test(content)) {
    await act(message, member, p.antiInvites.action, 'إرسال دعوات (Anti-Invite)');
    return;
  }

  // --- منع اللينكات ---
  if (p.antiLinks.enabled && LINK_RE.test(content)) {
    await act(message, member, p.antiLinks.action, 'إرسال لينكات (Anti-Link)');
    return;
  }

  // --- منع الكلمات السيئة ---
  if (p.badWords.enabled && Array.isArray(p.badWords.words) && p.badWords.words.length) {
    const words = p.badWords.words.map((w) => String(w).toLowerCase().trim()).filter(Boolean);
    const hit = words.find((w) => content.includes(w));
    if (hit) {
      await act(message, member, p.badWords.action, 'كلمة ممنوعة (Anti-Swear)');
      return;
    }
  }

  // --- منع المنشن سبام ---
  if (p.antiMention.enabled && message.mentions.users.size + message.mentions.roles.size > p.antiMention.maxMentions) {
    await act(message, member, p.antiMention.action, 'سبام منشن (Anti-Mention)');
    return;
  }

  // --- مضاد السبام ---
  if (p.antiSpam.enabled) {
    const key = `${guild.id}_${message.author.id}`;
    const now = Date.now();
    let times = client.spamTracker.get(key) || [];
    times = times.filter((t) => now - t < p.antiSpam.perSeconds * 1000);
    times.push(now);
    client.spamTracker.set(key, times);

    if (times.length > p.antiSpam.maxMessages) {
      client.spamTracker.set(key, []); // صفّر العدّاد بعد العقوبة
      await act(message, member, p.antiSpam.action, 'سبام رسائل (Anti-Spam)');
      return;
    }
  }
};

async function act(message, member, action, reason) {
  if (action !== 'delete') {
    await message.channel.send({
      embeds: [baseEmbed(COLORS.warn).setDescription(
        `⚠️ **${member.user.tag}** اتعاقب (${action}) — السبب: ${reason}`
      )],
    }).then((m) => setTimeout(() => m.delete().catch(() => {}), 6000)).catch(() => {});
  }
  await message.delete().catch(() => {});
  if (action !== 'delete') {
    await punish(member.guild, member, action, reason);
  }
}
