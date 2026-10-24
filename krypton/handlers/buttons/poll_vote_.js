// ═══════════════════════════════════════════════
//  Button: poll_vote_ - التصويت في الاقتراع
// ═══════════════════════════════════════════════

const pollsLib = require('../../utils/polls');

module.exports = {
  name: 'poll_vote_',

  async execute(interaction, client) {
    const optionIndex = parseInt(interaction.customId.replace('poll_vote_', ''));
    const message = interaction.message;
    const messageId = message.id;

    // ─── جيب حالة الاقتراع ───
    let poll = pollsLib.polls.get(messageId);
    if (!poll) {
      poll = pollsLib.loadPollFromEmbed(message);
      if (poll) pollsLib.polls.set(messageId, poll);
    }

    if (!poll) {
      return interaction.reply({
        content: '❌ مفيش بيانات للاقتراع ده.',
        ephemeral: true,
      });
    }

    const result = pollsLib.vote(poll, optionIndex, interaction.user.id);

    if (!result.ok) {
      return interaction.reply({
        content: result.reason === 'voted'
          ? '❌ انت صوتت قبل كده بالفعل.'
          : '❌ اختيار غير صالح.',
        ephemeral: true,
      });
    }

    // ─── تحديث الإمبد ───
    const embed = pollsLib.renderEmbed(message.embeds[0].title.replace(/^📊\s*/, ''), poll);
    await message.edit({ embeds: [embed] }).catch(() => {});

    return interaction.reply({
      content: '✅ تم تسجيل صوتك!',
      ephemeral: true,
    });
  },
};