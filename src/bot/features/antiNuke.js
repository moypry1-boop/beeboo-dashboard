// الحماية من النيوك: مراقبة الحذف الجماعي للقنوات/الرتب والبان الجماعي
const { Events } = require('discord.js');
const storage = require('../../storage');
const { COLORS, baseEmbed, logEvent } = require('../../utils/helpers');

const counters = new Map(); // key -> { count, windowStart }

function hit(guildId, userId) {
  const key = `${guildId}_${userId}`;
  const now = Date.now();
  let c = counters.get(key);
  if (!c || now - c.windowStart > 60_000) {
    c = { counts: {}, windowStart: now };
    counters.set(key, c);
  }
  return {
    inc(type) { c.counts[type] = (c.counts[type] || 0) + 1; return c.counts[type]; },
  };
}

async function getConfig(guild, executorId) {
  const s = storage.getGuild(guild.client._botId, guild.id);
  return s.antiNuke;
}

function isWhitelisted(cfg, executorId, guild) {
  if (executorId === guild.client.user.id) return true;
  if (executorId === guild.ownerId) return true;
  return (cfg.whitelistIds || []).includes(executorId);
}

async function punish(client, botId, guild, executorId, cfg, reason) {
  try {
    const member = await guild.members.fetch(executorId).catch(() => null);
    if (cfg.punish === 'ban' && member?.bannable) await member.ban({ reason });
    else if (cfg.punish === 'kick' && member?.kickable) await member.kick(reason);
    else if (member) {
      // removeroles: شيل كل الرتب القابلة للتعديل
      const roles = member.roles.cache.filter((r) => r.editable && r.id !== guild.id);
      await member.roles.remove([...roles.keys()], reason).catch(() => {});
    }
  } catch (e) {
    console.error('[ANTINUKE punish]', e.message);
  }

  const alertCh = cfg.alertChannelId && guild.channels.cache.get(cfg.alertChannelId);
  const alert = baseEmbed(COLORS.bad)
    .setTitle('🚨 محاولة نيوك اتصدت!')
    .setDescription(
      `**العضو:** <@${executorId}> (\`${executorId}\`)\n` +
      `**الإجراء:** ${cfg.punish}\n**السبب:** ${reason}`
    )
    .setTimestamp();
  if (alertCh?.isTextBased()) alertCh.send({ embeds: [alert] }).catch(() => {});
  logEvent(guild, 'channelChanges', alert);
  console.log(`[ANTINUKE] ${guild.name}: عقاب ${executorId} — ${reason}`);
}

// مراقب عام لحدث مع نوع عدّاد
function watch(event, type, getTargetDesc) {
  return async (...args) => {
    const [obj] = args;
    const guild = obj.guild;
    if (!guild || !guild.available) return;

    const cfg = await getConfig(guild);
    if (!cfg.enabled) return;

    // نجيب المنفذ من سجل التدقيق
    let executorId = null;
    try {
      const auditType = type === 'ban' ? 23 : type === 'kick' ? 20 : null; // GuildAuditLogs.Actions
      const logs = await guild.fetchAuditLogs(auditType ? { type: auditType, limit: 5 } : { limit: 5 }).catch(() => null);
      const entry = logs?.entries.first();
      if (entry && Date.now() - entry.createdTimestamp < 15_000) executorId = entry.executorId;
    } catch { /* ignore */ }
    if (!executorId) return;

    if (isWhitelisted(cfg, executorId, guild)) return;

    const limitKey = `max${type.charAt(0).toUpperCase()}${type.slice(1)}s`;
    const limit = cfg[limitKey] || 3;
    const count = hit(guild.id, executorId).inc(type);

    if (count >= limit) {
      counters.delete(`${guild.id}_${executorId}`);
      await punish(guild.client, guild.client._botId, guild, executorId, cfg,
        `Anti-Nuke: ${getTargetDesc(args)} (${count} خلال دقيقة)`);
    }
  };
}

module.exports = function register(client) {
  client.on(Events.ChannelDelete, watch('channelDelete', 'channelDelete', () => 'حذف قنوات'));
  client.on(Events.RoleDelete, watch('roleDelete', 'roleDelete', () => 'حذف رتب'));
  client.on(Events.GuildBanAdd, watch('banAdd', 'ban', ([ban]) => `حظر جماعي (${ban.user.tag})`));
  client.on(Events.GuildMemberRemove, async (member) => {
    // كيك فقط — البان له مراقبه
    try {
      const audit = await member.guild.fetchAuditLogs({ type: 20, limit: 5 }).catch(() => null);
      const kickEntry = audit?.entries.find((e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 10_000);
      if (kickEntry) {
        const cfg = await getConfig(member.guild);
        if (!cfg.enabled || isWhitelisted(cfg, kickEntry.executorId, member.guild)) return;
        const count = hit(member.guild.id, kickEntry.executorId).inc('kick');
        if (count >= (cfg.maxKicks || 5)) {
          counters.delete(`${member.guild.id}_${kickEntry.executorId}`);
          await punish(member.guild.client, member.guild.client._botId, member.guild, kickEntry.executorId, cfg,
            `Anti-Nuke: طرد جماعي (${count} خلال دقيقة)`);
        }
      }
    } catch { /* ignore */ }
  });
};
