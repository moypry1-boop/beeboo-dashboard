// ═══════════════════════════════════════════════
//  Polls Utility - حالة الاقتراعات
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');

// تخزين مؤقت: messageId -> { options, counts, voters }
const polls = new Map();

const EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function createPollStructure(options) {
  return {
    options,
    counts: options.map(() => 0),
    voters: new Set(),
  };
}

function vote(poll, optionIndex, userId) {
  if (poll.voters.has(userId)) return { ok: false, reason: 'voted' };
  if (optionIndex < 0 || optionIndex >= poll.options.length) return { ok: false, reason: 'invalid' };
  poll.voters.add(userId);
  poll.counts[optionIndex]++;
  return { ok: true };
}

function renderEmbed(question, poll, color = 0x3498db) {
  const fields = poll.options.map((opt, i) => ({
    name: `${EMOJIS[i] || '▪️'} ${opt}`,
    value: `**${poll.counts[i]}** صوت`,
    inline: true,
  }));

  fields.push({
    name: '📊 عدد المشاركين',
    value: `${poll.voters.size}`,
    inline: false,
  });

  return new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setDescription('صوت بالزرارات تحت 👇')
    .addFields(fields)
    .setColor(color)
    .setFooter({ text: 'KRYPTON Poll' })
    .setTimestamp();
}

// لو الحالة اتضاعت بعد إعادة التشغيل، نبنيها من الإمبد
function loadPollFromEmbed(message) {
  const embed = message.embeds[0];
  if (!embed) return null;

  const options = [];
  const counts = [];
  for (const field of embed.fields) {
    if (field.name.startsWith('1️⃣') || field.name.startsWith('2️⃣') || field.name.startsWith('3️⃣') ||
        field.name.startsWith('4️⃣') || field.name.startsWith('5️⃣') || field.name.startsWith('6️⃣') ||
        field.name.startsWith('7️⃣') || field.name.startsWith('8️⃣') || field.name.startsWith('9️⃣') || field.name.startsWith('🔟')) {
      let name = field.name.replace(/^[^\s]+\s/, '');
      options.push(name);
      const count = parseInt(field.value) || 0;
      counts.push(count);
    }
  }

  if (options.length === 0) return null;

  return {
    options,
    counts,
    voters: new Set(), // بعد الريستارت فايزرز الحاليين مش معروفين => يسمح بالتصويت تاني
    _reloaded: true,
  };
}

module.exports = { polls, EMOJIS, createPollStructure, vote, renderEmbed, loadPollFromEmbed };