const { handleSlash, handleTicketButton } = require('../slash');
const menuRoles = require('../features/menuRoles');

module.exports = async function (interaction) {
  try {
    if (interaction.isChatInputCommand()) return await handleSlash(interaction);
    if (interaction.isButton() && interaction.customId.startsWith('ticket_')) {
      return await handleTicketButton(interaction);
    }
    // قوائم الرتب الذاتية
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('mrselect:')) {
      return await menuRoles.handleSelect(interaction);
    }
  } catch (e) {
    console.error('[INTERACTION]', e);
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply('حصل خطأ غير متوقع 😥').catch(() => {});
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'حصل خطأ غير متوقع 😥', ephemeral: true }).catch(() => {});
    }
  }
};
