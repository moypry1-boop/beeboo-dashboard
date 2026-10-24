// ═══════════════════════════════════════════════
//  Event: roleUpdate - لوج تعديل رول
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { snapshotRole } = require('../utils/antinuke');

module.exports = {
  name: 'roleUpdate',
  once: false,

  async execute(oldRole, newRole, client) {
    snapshotRole(newRole);
    const changes = [];

    if (oldRole.name !== newRole.name) {
      changes.push(`Name: **${oldRole.name}** → **${newRole.name}**`);
    }
    if (oldRole.color !== newRole.color) {
      changes.push(`Color: **${oldRole.hexColor}** → **${newRole.hexColor}**`);
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push('Permissions were modified');
    }

    if (changes.length === 0) return;

    logger.warning('✏️ Role Updated', `Role **@${newRole.name}** was modified.`, {
      fields: [
        { name: 'Changes', value: changes.join('\n') },
      ],
    });
  },
};
