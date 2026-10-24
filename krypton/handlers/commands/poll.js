// ═══════════════════════════════════════════════
//  Command: /poll - إنشاء اقتراع بالزرارات
// ═══════════════════════════════════════════════

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const pollsLib = require('../../utils/polls');
const config = require('../../config');

module.exports = {
  name: 'poll',

  async execute(interaction, client) {
    const question = interaction.options.getString('question');
    const optionText = interaction.options.getString('options');
    const channelOpt = interaction.options.getChannel('channel');

    // ─── تحليل الخيارات ───
    const options = optionText
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (options.length < 2) {
      return interaction.reply({
        content: '❌ لازم على الأقل خيارين مفصولين بكومة (,)',
        ephemeral: true,
      });
    }

    const targetChannel = channelOpt || interaction.channel;

    // ─── أنشئ الاقتراع ───
    const poll = pollsLib.createPollStructure(options);
    const embed = pollsLib.renderEmbed(question, poll);

    const row = new ActionRowBuilder().addComponents(
      options.map((opt, i) =>
        new ButtonBuilder()
          .setCustomId(`poll_vote_${i}`)
          .setLabel(pollsLib.EMOJIS[i] || `${i + 1}`)
          .setStyle(ButtonStyle.Secondary)
      )
    );

    await targetChannel.send({ embeds: [embed], components: [row] }).then(msg => {
      pollsLib.polls.set(msg.id, poll);
    });

    return interaction.reply({
      content: `✅ تم إنشاء الاقتراع في ${targetChannel}`,
      ephemeral: true,
    });
  },
};