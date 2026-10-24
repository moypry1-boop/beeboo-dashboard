// ═══════════════════════════════════════════════
//  Event: roleDelete - لوج حذف رول + rollback + حماية
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { hit, isExempt, punish, rollbackRole, getRoleSnapshot, restoreRoleFromBackup } = require('../utils/antinuke');
const config = require('../config');

module.exports = {
  name: 'roleDelete',
  once: false,

  async execute(role, client) {
    logger.danger('🗑️ Role Deleted', `Role **@${role.name}** was deleted.`, {
      fields: [
        { name: 'Role Name', value: role.name },
        { name: 'Color', value: `${role.hexColor}` },
      ],
    });

    if (!config.antinuke.enabled) return;

    const audit = await role.guild.fetchAuditLogs({ type: 32, limit: 1 }).catch(() => null);
    let executorId = null;
    if (audit) {
      const entry = audit.entries.first();
      if (entry) executorId = entry.executor?.id;
    }

    // Rollback: أولاً من الـ snapshot، لو مفيش يرجع للـ backup
    const snap = getRoleSnapshot(role.id);
    if (config.antinuke.rollback.roles) {
      if (snap) {
        await rollbackRole(role.guild, snap);
      } else {
        await restoreRoleFromBackup(role.guild, role.id);
      }
    }

    if (executorId) {
      const member = role.guild.members.cache.get(executorId);
      if (member && !isExempt(member) && hit(executorId, 'roleDelete', config.antinuke.banRoleDelete)) {
        await punish(member, 'roleDelete (flood)', client, { reason: 'حذف رولات بسرعة' });
      }
    }
  },
};