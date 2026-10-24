// ═══════════════════════════════════════════════
//  SelectMenu: roles_select - توزيع الرولات
// ═══════════════════════════════════════════════

const { logger } = require('../../utils/logger');

module.exports = {
  name: 'roles_select',

  async execute(interaction, client) {
    const member = interaction.member;
    const selected = interaction.values;

    // ─── منع امتلاك الرولات (سكيورتي) ───
    if (member.id === interaction.guild.ownerId) {
      return interaction.reply({ content: 'أنت الأونر، عندك كل حاجة 😄', ephemeral: true });
    }

    const added = [];
    const removed = [];

    for (const roleId of selected) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
        removed.push(`<@&${roleId}>`);
      } else {
        await member.roles.add(roleId).catch(() => {});
        added.push(`<@&${roleId}>`);
      }
    }

    const parts = [];
    if (added.length) parts.push(`✅ **تم إضافة:** ${added.join(', ')}`);
    if (removed.length) parts.push(`❌ **تم الإزالة:** ${removed.join(', ')}`);

    logger.info('🎭 Roles Updated', `**${member.user.tag}** updated their roles via the roles panel.`, {
      fields: [
        { name: 'User', value: `<@${member.id}>` },
        { name: 'Added', value: added.join(', ') || 'None' },
        { name: 'Removed', value: removed.join(', ') || 'None' },
      ],
    });

    return interaction.reply({
      content: parts.join('\n') || '🤔 مفيش تغيير.',
      ephemeral: true,
    });
  },
};