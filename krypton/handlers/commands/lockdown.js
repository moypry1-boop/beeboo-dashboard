// ═══════════════════════════════════════════════
//  Command: /lockdown - قفل/فتح السيرفر
// ═══════════════════════════════════════════════

const { PermissionFlagsBits } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');
const { isAdmin } = require('../../utils/permissions');

module.exports = {
  name: 'lockdown',

  async execute(interaction, client) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للأدمن فقط.', ephemeral: true });
    }

    const action = interaction.options.getString('action');

    if (action === 'on') {
      // ─── احفظ كل رومات Text بالقفل واحجب SendMessages ───
      const textChannels = interaction.guild.channels.cache.filter(c => c.isTextBased() && c.permissionsFor(interaction.guild.id).has(PermissionFlagsBits.SendMessages));
      const snapshot = [];

      for (const [, ch] of textChannels) {
        const overwrites = ch.permissionOverwrites.cache.get(interaction.guild.id);
        const hadSend = !overwrites || overwrites.allow.has(PermissionFlagsBits.SendMessages);
        if (hadSend) {
          await ch.permissionOverwrites.edit(interaction.guild.id, ({ SendMessages: false })).catch(() => {});
          snapshot.push(ch.id);
        }
      }

      storage.setLockdown({ channels: snapshot });
      interaction.guild.channels.cache.get(config.ids.logChannel)?.send({ content: '🚨 **LOCKDOWN ACTIVE**' }).catch(() => {});

      logger.security('🚨 LOCKDOWN ON', `**${interaction.user.tag}** locked down the server.`, {
        fields: [{ name: 'Channels Locked', value: `${snapshot.length}` }],
      });

      return interaction.reply({
        content: `🔒 تم قفل السيرفر! **${snapshot.length}** روم اتقفل عن الرسايل.`,
      });
    }

    // ─── فتح ───
    const lockdown = storage.getLockdown();
    if (lockdown && lockdown.channels) {
      for (const chId of lockdown.channels) {
        const ch = interaction.guild.channels.cache.get(chId);
        if (ch) {
          await ch.permissionOverwrites.edit(interaction.guild.id, { SendMessages: null }).catch(() => {});
        }
      }
    }
    storage.setLockdown(null);

    logger.security('🔓 LOCKDOWN OFF', `**${interaction.user.tag}** lifted the lockdown.`);

    return interaction.reply({ content: '🔓 تم فتح السيرفر!' });
  },
};