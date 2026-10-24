// ═══════════════════════════════════════════════
//  Command: /giveaway - إنشاء جيف أواي
// ═══════════════════════════════════════════════

const config = require('../../config');
const storage = require('../../utils/storage');
const { parseDuration } = require('../../utils/time');
const { createGiveawayEmbed, createEntryRow } = require('../../utils/giveaways');

module.exports = {
  name: 'giveaway',

  async execute(interaction, client) {
    const prize = interaction.options.getString('prize');
    const durationStr = interaction.options.getString('duration');
    const winnersCount = interaction.options.getInteger('winners') || 1;
    const channelOpt = interaction.options.getChannel('channel');

    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({
        content: '❌ المدة لازم تكون زي: `10s`, `5m`, `2h`, `1d`',
        ephemeral: true,
      });
    }
    if (duration > config.giveaways.maxDuration) {
      return interaction.reply({
        content: '❌ أقصى مدة للجيف أواي هي أسبوع.',
        ephemeral: true,
      });
    }

    const targetChannel = channelOpt || interaction.guild.channels.cache.get(config.giveaways.defaultChannel) || interaction.channel;

    const endsAt = Date.now() + duration;
    const gw = {
      messageId: null,
      channelId: targetChannel.id,
      prize,
      endsAt,
      winners: winnersCount,
      entrants: [],
    };

    const embed = createGiveawayEmbed(gw, 0);
    const msg = await targetChannel.send({ content: '🎉 **جيف أواي جديد!**', embeds: [embed], components: [createEntryRow()] });

    gw.messageId = msg.id;
    storage.addGiveaway(gw);

    return interaction.reply({
      content: `✅ تم إنشاء الجيف أواي في ${targetChannel}\nالموضوع: **${prize}**\nينتهي <t:${Math.floor(endsAt / 1000)}:R>`,
      ephemeral: true,
    });
  },
};