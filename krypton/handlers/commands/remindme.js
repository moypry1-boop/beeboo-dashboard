// ═══════════════════════════════════════════════
//  Command: /remindme - تذكير
// ═══════════════════════════════════════════════

const storage = require('../../utils/storage');
const { parseDuration } = require('../../utils/time');

module.exports = {
  name: 'remindme',

  async execute(interaction, client) {
    const durationStr = interaction.options.getString('time');
    const text = interaction.options.getString('text');

    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({
        content: '❌ المدة لازم تكون زي: `30s`, `10m`, `1h`, `1d`',
        ephemeral: true,
      });
    }
    if (duration > 7 * 24 * 60 * 60 * 1000) {
      return interaction.reply({ content: '❌ أقصى مدة هي أسبوع.', ephemeral: true });
    }

    const at = Date.now() + duration;
    storage.addReminder(interaction.user.id, at, text);

    return interaction.reply({
      content: `⏰ هيوصلك تذكير <t:${Math.floor(at / 1000)}:R>\n📌 **${text}**`,
      ephemeral: true,
    });
  },
};