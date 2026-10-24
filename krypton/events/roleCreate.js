// ═══════════════════════════════════════════════
//  Event: roleCreate - لوج + حماية الرولات
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { checkRateLimit } = require('../utils/protection');
const { hit, isExempt, punish, snapshotRole } = require('../utils/antinuke');
const config = require('../config');

module.exports = {
  name: 'roleCreate',
  once: false,

  async execute(role, client) {
    snapshotRole(role);
    logger.info('🏷️ Role Created', `Role **@${role.name}** was created.`, {
      fields: [
        { name: 'Role', value: `<@&${role.id}>` },
        { name: 'Color', value: `${role.hexColor}` },
      ],
    });

    // حماية
    const audit = await role.guild.fetchAuditLogs({ type: 1, limit: 1 }).catch(() => null);
    if (audit) {
      const entry = audit.entries.first();
      if (entry && entry.executor && !entry.executor.bot) {
        const member = role.guild.members.cache.get(entry.executor.id);
        if (config.antinuke.enabled && !isExempt(member)) {
          if (hit(entry.executor.id, 'roleCreate', config.antinuke.banRoleCreate)) {
            await punish(member, 'roleCreate (flood)', client, { reason: 'إنشاء رولات بسرعة' });
          }
        }
        const result = checkRateLimit(entry.executor.id, 'roleCreate', config.protection.maxRoleCreates);
        if (result.limited) {
          logger.security('🛡️ ROLE RATE LIMIT', `**${entry.executor.tag}** creating roles too fast!`, {
            fields: [
              { name: 'User', value: `<@${entry.executor.id}>` },
              { name: 'Count', value: `${result.count} roles in window` },
            ],
          });
        }
      }
    }
  },
};
