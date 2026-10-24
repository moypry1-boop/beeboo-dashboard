// ═══════════════════════════════════════════════
//  Giveaways Utility - الجيف أواي
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const storage = require('./storage');
const { logger } = require('./logger');
const config = require('../config');

function createGiveawayEmbed(gw, entrantsCount) {
  return new EmbedBuilder()
    .setTitle('🎁 GIVEAWAY')
    .setDescription(
      `**الجائزة:** ${gw.prize}\n\n` +
      `**المشاركين:** ${entrantsCount}\n` +
      `**عدد الفايزين:** ${gw.winners}\n\n` +
      `ينتهي في: <t:${Math.floor(gw.endsAt / 1000)}:R>`
    )
    .setColor(0xf1c40f)
    .setFooter({ text: `ID: ${gw.messageId}` })
    .setTimestamp();
}

function createEntryRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel('🎉 Enter')
      .setStyle(ButtonStyle.Success)
  );
}

function pickWinners(entrants, count) {
  const pool = [...entrants];
  const winners = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

async function checkGiveaways(client) {
  const giveaways = storage.getGiveaways();
  const now = Date.now();

  for (const gw of giveaways) {
    if (gw.endsAt > now) continue;

    try {
      const channel = await client.channels.fetch(gw.channelId).catch(() => null);
      if (!channel) {
        storage.removeGiveaway(gw.messageId);
        continue;
      }

      const message = await channel.messages.fetch(gw.messageId).catch(() => null);
      const winners = pickWinners(gw.entrants, gw.winners);
      const entries = `🎉 **الفايزين في جيف أواي "${gw.prize}":**\n${winners.map(w => `<@${w}>`).join(' ')}\n\nمبروك! 🥳`;

      if (message) {
        await message.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎁 GIVEAWAY Ended')
              .setDescription(`**الجائزة:** ${gw.prize}\n**عدد المشاركين:** ${gw.entrants.length}\n**الفايزين:** ${winners.map(w => `<@${w}>`).join(', ') || 'لا يوجد'}`)
              .setColor(0x2ecc71)
              .setFooter({ text: 'Giveaway Ended' }),
          ],
          components: [],
        }).catch(() => {});

        const pingText = winners.length > 0 ? winners.map(w => `<@${w}>`).join(' ') : '';
        if (config.giveaways.pingOnEnd && pingText) {
          await channel.send({ content: pingText, embeds: [
            new EmbedBuilder()
              .setTitle('🎊 Giveaway Winners!')
              .setDescription(entries)
              .setColor(0xf1c40f),
          ] }).catch(() => {});
        }
      }

      logger.success('🎁 Giveaway Ended', `Giveaway **${gw.prize}** has ended.`, {
        fields: [
          { name: 'Winners', value: winners.map(w => `<@${w}>`).join(', ') || 'None' },
          { name: 'Participants', value: `${gw.entrants.length}` },
        ],
      });
    } catch (err) {
      console.error('[Giveaway] Error checking:', err.message);
    }

    storage.removeGiveaway(gw.messageId);
  }
}

module.exports = { checkGiveaways, createGiveawayEmbed, createEntryRow, pickWinners };