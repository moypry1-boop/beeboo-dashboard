// ═══════════════════════════════════════════════
//  Event: guildMemberUpdate - لوج تعديل رولات العضو
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const config = require('../config');
const { hit, isExempt, punish } = require('../utils/antinuke');

module.exports = {
  name: 'guildMemberUpdate',
  once: false,

  async execute(oldMember, newMember, client) {
    // ─── حماية الأونر: منع إزالة رول المالك ───
    const ownerRoleId = config.ids.ownerRoleId || config.ids.adminRoleId || config.ids.staffRoleId;
    const isProtectedOwner =
      newMember.id === newMember.guild.ownerId ||
      (config.ids.ownerId && config.ids.ownerId !== 'OWNER_USER_ID_HERE' && newMember.id === config.ids.ownerId);
    if (ownerRoleId && isProtectedOwner) {
      const oldHas = oldMember.roles.cache.has(ownerRoleId);
      const newHas = newMember.roles.cache.has(ownerRoleId);
      if (oldHas && !newHas) {
        // حاولوا ياخدوا من المالك روله — نرجّعه فورًا
        try {
          await newMember.roles.add(ownerRoleId, 'Owner protection').catch(() => {});
        } catch {}
        // نجيب الجاني
        const audit = await newMember.guild.fetchAuditLogs({ type: 25, limit: 5 }).catch(() => null);
        let executorId = null;
        if (audit) {
          for (const entry of audit.entries.values()) {
            if (entry.targetId === newMember.id && !entry.executor.bot) {
              executorId = entry.executor.id;
              break;
            }
          }
        }
        if (executorId) {
          const m = newMember.guild.members.cache.get(executorId);
          if (m && !isExempt(m)) {
            await punish(m, 'owner role remove attempt', client, { reason: 'محاولة إزالة رول المالك' });
          }
        }
        logger.danger('👑 OWNER Protection', `<@${newMember.id}> tried to have owner role removed!`);
      }
    }

    // ─── تغيير الرولات ───
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const fields = [];

      if (addedRoles.size > 0) {
        fields.push({ name: '➕ Added Roles', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: false });
      }
      if (removedRoles.size > 0) {
        fields.push({ name: '➖ Removed Roles', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: false });
      }

      // حاول تجيب مين عدّل
      const audit = await newMember.guild.fetchAuditLogs({ type: 25, limit: 5 }).catch(() => null);
      if (audit) {
        for (const entry of audit.entries.values()) {
          if (entry.targetId === newMember.id && !entry.executor.bot) {
            fields.push({ name: 'Modified By', value: `<@${entry.executor.id}>`, inline: false });
            break;
          }
        }
      }

      logger.mod('🔄 Roles Updated', `**${newMember.user.tag}** roles were modified.`, { fields });
    }

    // ─── مكت/أنميت ───
    if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
      logger.mod('🔇 Member Timed Out', `**${newMember.user.tag}** was timed out.`, {
        fields: [
          { name: 'User', value: `<@${newMember.id}>` },
          { name: 'Until', value: `<t:${Math.floor(newMember.communicationDisabledUntil.getTime() / 1000)}:R>` },
          { name: 'Reason', value: newMember.communicationDisabledUntilReason || 'No reason' },
        ],
      });
    }

    if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
      logger.success('🔊 Timeout Removed', `**${newMember.user.tag}** timeout was removed.`, {
        fields: [{ name: 'User', value: `<@${newMember.id}>` }],
      });
    }
  },
};