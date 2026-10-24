// ═══════════════════════════════════════════════
//  Command: /warn - تحذير عضو
// ═══════════════════════════════════════════════

const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');

module.exports = {
  name: 'warn',

  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للإدارة فقط.', ephemeral: true });
    }

    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (!target) return interaction.reply({ content: '❌ العضو مش موجود.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ ماتحذرش نفسك.', ephemeral: true });

    const warnings = storage.addWarning(target.id, interaction.user.id, reason);

    logger.mod('⚠️ User Warned', `**${target.user.tag}** was warned by **${interaction.user.tag}**.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Moderator', value: `<@${interaction.user.id}>` },
        { name: 'Reason', value: reason },
        { name: 'Total Warnings', value: `${warnings.length}` },
      ],
    });

    // ─── مكت تلقائي عند الوصول للحد ───
    let muted = false;
    if (warnings.length >= config.warnings.maxWarningsBeforeMute) {
      if (target.moderatable) {
        await target.timeout(config.warnings.muteDuration, `Reached ${warnings.length} warnings`).catch(() => {});
        muted = true;
      }
      storage.clearWarnings(target.id); // تصفير بعد المكت
    }

    try {
      await target.send({
        embeds: [
          {
            title: '⚠️ تم تحذيرك',
            description: `**السبب:** ${reason}\n**عدد التحذيرات:** ${warnings.length}/${config.warnings.maxWarningsBeforeMute}`,
            color: 0xf39c12,
            footer: { text: 'KRYPTON Moderation' },
          },
        ],
      }).catch(() => {});
    } catch {}

    return interaction.reply({
      content: `✅ تم تحذير **${target.user.tag}**\n**السبب:** ${reason}\n` + (muted ? '🔇 تم عمل مكت تلقائي (وصلت للحد)!' : `**التحذيرات:** ${warnings.length}/${config.warnings.maxWarningsBeforeMute}`),
    });
  },
};