// ═══════════════════════════════════════════════
//  Button: welcome_rules - زر قبول القوانين
// ═══════════════════════════════════════════════

const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'welcome_rules',

  async execute(interaction, client) {
    const member = interaction.member;

    if (storage.hasAcceptedRules(member.id)) {
      return interaction.reply({
        content: '✅ أنت وافقت على القوانين من قبل!',
        ephemeral: true,
      });
    }

    storage.acceptRules(member.id);

    // مفيش رول مخصص للقوانين حاليًا - ممكن تضيفه لو حبيت
    logger.verify('📜 Rules Accepted', `**${member.user.tag}** accepted the server rules.`, {
      fields: [{ name: 'User', value: `<@${member.id}>` }],
    });

    return interaction.reply({
      content: '✅ شكراً! وافقت على القوانين. أهلاً بيك في KRYPTON 🛡️',
      ephemeral: true,
    });
  },
};