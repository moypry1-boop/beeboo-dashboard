// ═══════════════════════════════════════════════
//  Event: guildMemberRemove - عضو مشي
// ═══════════════════════════════════════════════

const { logger } = require('../utils/logger');
const { hit, isExempt, punish } = require('../utils/antinuke');
const config = require('../config');

module.exports = {
  name: 'guildMemberRemove',
  once: false,

  async execute(member, client) {
    logger.info('📤 Member Left', `**${member.user.tag}** left the server.`, {
      fields: [
        { name: 'User', value: `<@${member.id}> (${member.id})` },
        { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ') || 'None' },
        { name: 'Member Count', value: `${member.guild.memberCount}` },
      ],
    });

    if (!config.antinuke.enabled) return;

    // نحاول نعرف مين عمل كيك (Audit Log type 20 = MEMBER_KICK)
    const audit = await member.guild.fetchAuditLogs({ type: 20, limit: 1 }).catch(() => null);
    if (!audit) return;
    const entry = audit.entries.first();
    if (!entry) return;
    const executor = entry.executor;
    if (!executor || executor.bot) return;
    if (executor.id === member.guild.ownerId) return;
    if (config.ids.ownerId && config.ids.ownerId !== 'OWNER_USER_ID_HERE' && executor.id === config.ids.ownerId) return;
    if (entry.target?.id !== member.id) return; // مش كيك

    if (hit(executor.id, 'guildMemberRemove', config.antinuke.banKickThread)) {
      const m = member.guild.members.cache.get(executor.id);
      if (!isExempt(m)) {
        await punish(m, 'guildMemberRemove (kick flood)', client, { reason: 'كيك بمعظم' });
      }
    }
  },
};
