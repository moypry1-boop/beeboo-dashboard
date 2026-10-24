// ═══════════════════════════════════════════════
//  Event: interactionCreate - معالجة كل التفاعلات
// ═══════════════════════════════════════════════

const { InteractionType } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    // ─── Slash Commands ───
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // ─── فحص الصلاحيات المركزي (قبل أي تنفيذ) ───
      const { canExecute, deniedMessage } = require('../utils/commandGuard');
      if (interaction.inGuild() && !canExecute(interaction.member, interaction.commandName)) {
        return interaction.reply({
          content: deniedMessage(interaction.commandName),
          ephemeral: true,
        });
      }

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[Command Error] ${interaction.commandName}:`, err);
        const reply = {
          content: '❌ حصل خطأ أثناء تنفيذ الأمر.',
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }

    // ─── Buttons ───
    if (interaction.isButton()) {
      const button = client.buttons.get(interaction.customId);
      // Try prefix match for dynamic IDs
      let handler = button;
      if (!handler) {
        for (const [name, btn] of client.buttons) {
          if (interaction.customId.startsWith(name)) {
            handler = btn;
            break;
          }
        }
      }

      if (handler) {
        try {
          await handler.execute(interaction, client);
        } catch (err) {
          console.error(`[Button Error] ${interaction.customId}:`, err);
          await interaction.reply({ content: '❌ حصل خطأ.', ephemeral: true }).catch(() => {});
        }
      }
    }

    // ─── Select Menus ───
    if (interaction.isStringSelectMenu()) {
      const menu = client.selectMenus.get(interaction.customId);
      if (menu) {
        try {
          await menu.execute(interaction, client);
        } catch (err) {
          console.error(`[SelectMenu Error] ${interaction.customId}:`, err);
          await interaction.reply({ content: '❌ حصل خطأ.', ephemeral: true }).catch(() => {});
        }
      }
    }

    // ─── Modals ───
    if (interaction.type === InteractionType.ModalSubmit) {
      const modal = client.modals.get(interaction.customId);
      if (modal) {
        try {
          await modal.execute(interaction, client);
        } catch (err) {
          console.error(`[Modal Error] ${interaction.customId}:`, err);
          await interaction.reply({ content: '❌ حصل خطأ.', ephemeral: true }).catch(() => {});
        }
      }
    }
  },
};
