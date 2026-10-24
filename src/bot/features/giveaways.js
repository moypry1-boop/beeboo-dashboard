// نظام السحب على الهدايا — فحص دوري وسحب تلقائي للفايز
const { EmbedBuilder } = require('discord.js');
const storage = require('../../storage');
const { COLORS } = require('../../utils/helpers');

function activeList(guildSettings) { return guildSettings.giveaways || []; }

async function tick(pool) {
  for (const [botId, client] of pool.clients) {
    const guilds = client.guilds.cache;
    for (const guild of guilds.values()) {
      let changed = false;
      const gws = storage.getGuild(botId, guild.id).giveaways || [];

      for (const gw of gws) {
        if (gw.ended) continue;
        if (Date.now() < gw.endsAt) continue;

        // انتهت — نسحب الفايز
        try {
          const channel = guild.channels.cache.get(gw.channelId);
          const msg = channel ? await channel.messages.fetch(gw.messageId).catch(() => null) : null;
          let entries = [];
          if (msg) {
            const reaction = msg.reactions.cache.get('🎉');
            const users = reaction ? await reaction.users.fetch().catch(() => null) : null;
            if (users) entries = [...users.values()].filter((u) => !u.bot);
          }

          const winners = [];
          const pool2 = [...entries];
          for (let i = 0; i < Math.min(gw.winnerCount, 10) && pool2.length; i++) {
            winners.push(pool2.splice(Math.floor(Math.random() * pool2.length), 1)[0]);
          }

          const embed = EmbedBuilder.from(msg?.embeds[0] || new EmbedBuilder().setTitle(`🎁 ${gw.prize}`))
            .setColor(winners.length ? COLORS.good : COLORS.bad)
            .addFields({
              name: '🏆 الفايز',
              value: winners.length
                ? winners.map((w) => `🎉 ${w}`).join('\n')
                : 'محدش دخل في السحبة 😢',
            });

          if (msg) {
            await msg.edit({ content: '🏁 **انتهت السحبة!**', embeds: [embed] }).catch(() => {});
          }
          if (channel && winners.length) {
            await channel.send(
              `مبروووك ${winners.map((w) => `<@${w.id}>`).join(' ')} 🎉 كسبت **${gw.prize}**!`
            ).catch(() => {});
          }
        } catch (e) {
          console.error('[GIVEAWAY]', e.message);
        }

        gw.ended = true;
        gw.winners = (gw.winners || []).concat([]);
        changed = true;
      }

      if (changed) {
        storage.updateGuild(botId, guild.id, (s) => { s.giveaways = gws; });
      }
    }
  }
}

// إنشاء سحبة جديدة
async function createGiveaway(client, botId, guild, cfg) {
  const endsAt = Date.now() + cfg.durationMinutes * 60 * 1000;
  const embed = new EmbedBuilder()
    .setColor(COLORS.main)
    .setTitle(`🎁 ${cfg.prize}`)
    .setDescription(
      `اضغط تفاعل 🎉 عشان تدخل السحبة!\n` +
      `⏰ ينتهي: <t:${Math.floor(endsAt / 1000)}:R>\n` +
      `👥 عدد الفايزين: **${cfg.winnerCount}**\n` +
      `👤 المنظم: <@${cfg.hostedBy}>`
    )
    .setFooter({ text: 'WICKS Giveaway' })
    .setTimestamp(new Date(endsAt));

  const channel = guild.channels.cache.get(cfg.channelId);
  if (!channel?.isTextBased()) throw new Error('روم السحبة غير صالح');

  const msg = await channel.send({ content: '🎉 **سحبة جديدة!**', embeds: [embed] });
  await msg.react('🎉').catch(() => {});

  const entry = {
    id: msg.id,
    messageId: msg.id,
    channelId: cfg.channelId,
    prize: cfg.prize,
    winnerCount: cfg.winnerCount,
    durationMinutes: cfg.durationMinutes,
    endsAt,
    hostedBy: cfg.hostedBy,
    ended: false,
    createdAt: Date.now(),
  };

  storage.updateGuild(botId, guild.id, (s) => {
    s.giveaways = [...(s.giveaways || []), entry].slice(-50); // نحتفظ بآخر 50 سحبة
  });
  return entry;
}

module.exports = { tick, createGiveaway };
