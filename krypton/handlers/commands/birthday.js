// ═══════════════════════════════════════════════
//  Command: /birthday - تسجيل عيد ميلاد
// ═══════════════════════════════════════════════

const storage = require('../../utils/storage');

module.exports = {
  name: 'birthday',

  async execute(interaction, client) {
    const dateStr = interaction.options.getString('date');
    const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})$/);

    if (!match) {
      return interaction.reply({
        content: '❌ الصيغة لازم تكون `DD/MM` زي: `15/03`',
        ephemeral: true,
      });
    }

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);

    if (day < 1 || day > 31 || month < 1 || month > 12) {
      return interaction.reply({ content: '❌ تاريخ غير صالح.', ephemeral: true });
    }

    const formatted = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
    storage.setBirthday(interaction.user.id, formatted);

    return interaction.reply({
      content: `🎂 تم تسجيل عيد ميلادك: **${day}/${month}**\nفي اليوم ده هبعتلك تهنئة في الشات! 🎉`,
      ephemeral: true,
    });
  },
};