// نظام الاقتراحات — تصويت بالريأكشن وتحديث العدّاد + موافقة/رفض بالمودريتور
const { EmbedBuilder, Events } = require('discord.js');
const storage = require('../../storage');
const { COLORS } = require('../../utils/helpers');
const { PermissionFlagsBits } = require('discord.js');

function baseEmbed(sug) {
  return new EmbedBuilder()
    .setColor(sug.status === 'approved' ? COLORS.good : sug.status === 'rejected' ? COLORS.bad : COLORS.info)
    .setTitle(`💡 اقتراح #${sug.number} ${sug.status === 'approved' ? '✅ مقبول' : sug.status === 'rejected' ? '❌ مرفوض' : '⏳ تحت المراجعة'}`)
    .setDescription(sug.content)
    .addFields({ name: 'التصويتات', value: `👍 ${sug.up || 0} — 👎 ${sug.down || 0}`, inline: true })
    .setFooter({ text: `من: ${sug.authorTag}` })
    .setTimestamp(sug.at);
}

async function findSuggestion(botId, guild, messageId) {
  const s = storage.getGuild(botId, guild.id);
  const sug = (s.suggestions.items || []).find((x) => x.messageId === messageId);
  return { s, sug };
}

async function refresh(message, botId) {
  if (!message.guild || message.partial) return;
  const { s, sug } = await findSuggestion(botId, message.guild.id, message.id);
  if (!sug) return;

  const up = message.reactions.cache.get('👍')?.count - 1 || 0;
  const down = message.reactions.cache.get('👎')?.count - 1 || 0;
  sug.up = Math.max(0, up);
  sug.down = Math.max(0, down);

  await message.edit({ embeds: [baseEmbed(sug)] }).catch(() => {});
  storage.updateGuild(botId, message.guild.id, () => {}); // حفظ (s مرجع حي)
}

function register(client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
    if (!reaction || !reaction.message.guild) return;
    const msg = reaction.message;
    const botId = msg.client._botId;
    const { sug } = await findSuggestion(botId, msg.guild.id, msg.id);
    if (!sug) return;

    // موافقة/رفض من المشرفين
    if (['✅', '❌'].includes(reaction.emoji.name)) {
      const member = await msg.guild.members.fetch(user.id).catch(() => null);
      if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await msg.reactions.cache.get(reaction.emoji.name)?.users.remove(user.id).catch(() => {});
        return;
      }
      sug.status = reaction.emoji.name === '✅' ? 'approved' : 'rejected';
      storage.updateGuild(botId, msg.guild.id, () => {});
      await msg.edit({ embeds: [baseEmbed(sug)] }).catch(() => {});
      return;
    }

    // عدّادات التصويت
    await refresh(msg, botId);
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) reaction = await reaction.fetch().catch(() => null);
    if (!reaction || !reaction.message.guild) return;
    if (!['👍', '👎'].includes(reaction.emoji.name)) return;
    await refresh(reaction.message, reaction.message.client._botId);
  });
};

// إنشاء اقتراح جديد (من أمر /suggest)
async function create(client, guild, user, content) {
  const botId = client._botId;
  const s = storage.getGuild(botId, guild.id);
  if (!s.suggestions.enabled || !s.suggestions.channelId) throw new Error('نظام الاقتراحات مش مفعّل');

  const ch = guild.channels.cache.get(s.suggestions.channelId);
  if (!ch?.isTextBased()) throw new Error('روم الاقتراحات غير صالح');

  const number = (s.suggestions.items?.length || 0) + 1;
  const sug = {
    messageId: '',
    number,
    content: String(content).slice(0, 800),
    authorTag: user.tag,
    status: 'pending',
    up: 0,
    down: 0,
    at: Date.now(),
  };

  const msg = await ch.send({ embeds: [baseEmbed(sug)] });
  await msg.react('👍').catch(() => {});
  await msg.react('👎').catch(() => {});

  sug.messageId = msg.id;
  storage.updateGuild(botId, guild.id, (st) => {
    st.suggestions.items = [...(st.suggestions.items || []), sug].slice(-200);
  });
  return msg;
}

module.exports = { register, create };
