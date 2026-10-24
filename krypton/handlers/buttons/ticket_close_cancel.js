// ═══════════════════════════════════════════════
//  Button: ticket_close_cancel - إلغاء القفل
// ═══════════════════════════════════════════════

module.exports = {
  name: 'ticket_close_cancel',

  async execute(interaction, client) {
    return interaction.reply({
      content: '✅ تم الإلغاء. التيكت مستمر.',
      ephemeral: true,
    });
  },
};