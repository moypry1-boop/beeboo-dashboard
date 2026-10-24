// ═══════════════════════════════════════════════
//  Anti-Nuke Utility - حماية متقدمة من الهجمات
// ═══════════════════════════════════════════════

const config = require('../config');
const { logger } = require('./logger');
const { EmbedBuilder } = require('discord.js');

const actionCounts = new Map();

function getKey(userId, action) {
  return `${userId}:${action}`;
}

// سجل إجراء + اعرف لو تجاوز الحد
function hit(userId, action, maxCount, windowMs = 60000) {
  const key = getKey(userId, action);
  const now = Date.now();
  if (!actionCounts.has(key)) actionCounts.set(key, []);
  const arr = actionCounts.get(key);
  while (arr.length && arr[0] < now - windowMs) arr.shift();
  arr.push(now);
  return arr.length > maxCount;
}

// هل المالك معفى؟ (من config أو من مالك السيرفر الفعلي)
function isOwner(memberOrId) {
  if (typeof memberOrId === 'string') {
    if (config.ids.ownerId && config.ids.ownerId !== 'OWNER_USER_ID_HERE') return memberOrId === config.ids.ownerId;
    return false;
  }
  const member = memberOrId;
  const guildOwner = member?.guild?.ownerId;
  if (guildOwner && member.id === guildOwner) return true;
  return config.ids.ownerId && config.ids.ownerId !== 'OWNER_USER_ID_HERE' && member.id === config.ids.ownerId;
}

// هل العضو معفى من الحماية؟
function isExempt(member) {
  if (!member) return false;
  if (isOwner(member)) return true;
  if (member.user && member.user.bot) return false; // البوتات مش معفية
  const exemptRoles = config.antinuke.exemptRoles || [];
  return exemptRoles.some((r) => member.roles.cache.has(r));
}

function hitFail(member, action, maxCount) {
  return hit(member.id, action, maxCount);
}

// ─── العقوبة المتقدمة ───
async function punish(member, action, client, context = {}) {
  if (!member || member.user?.bot) return;
  const p = config.antinuke.punishment || 'ban';

  const logChan = client.channels.cache.get(config.antinuke.logChannelId);
  const embed = new EmbedBuilder()
    .setTitle('🚨 Anti-Nuke Triggered')
    .setDescription(
      `**الجاني:** <@${member.id}>\n` +
      `**الفعل:** \`${action}\`\n` +
      (context.reason ? `**السبب:** ${context.reason}\n` : '')
    )
    .setColor(0xff0000)
    .setTimestamp();

  let punished = false;
  try {
    if (p === 'ban') {
      await member.ban({ reason: `Anti-Nuke: ${action}` });
      punished = true;
    } else if (p === 'kick') {
      await member.kick(`Anti-Nuke: ${action}`);
      punished = true;
    } else if (p === 'strip') {
      await member.roles.set([], `Anti-Nuke: ${action}`);
      punished = true;
    }
  } catch (e) {
    embed.addFields({ name: '⚠️ فشلت العقوبة', value: e.message });
  }

  if (logChan) {
    embed.addFields({ name: 'النتيجة', value: punished ? '✅ تم تنفيذ العقوبة' : '❌ فشلت العقوبة' });
    logChan.send({ embeds: [embed] }).catch(() => {});
  }

  logger.security('🚨 Anti-Nuke', `<@${member.id}> triggered **${action}**`);
}

// ─── Rollback: إعادة إنشاء الكانتزات المحذوفة ───
async function rollbackChannel(guild, channelSnapshot) {
  if (!config.antinuke.rollback.channels) return;
  try {
    const opts = {
      name: channelSnapshot.name,
      type: channelSnapshot.type,
      topic: channelSnapshot.topic,
      nsfw: channelSnapshot.nsfw,
      parent: channelSnapshot.parentId,
      permissionOverwrites: channelSnapshot.permissionOverwrites?.map((o) => ({
        id: o.id,
        allow: o.allow?.bitfield ?? 0,
        deny: o.deny?.bitfield ?? 0,
      })),
    };
    const created = await guild.channels.create(opts);
    logger.security('♻️ Rollback', `Channel **${channelSnapshot.name}** recreated as <#${created.id}>`);
    return created;
  } catch (e) {
    console.error('[Anti-Nuke] rollback channel:', e.message);
  }
}

// ─── Rollback: إعادة إنشاء الرولات المحذوفة ───
async function rollbackRole(guild, roleSnapshot) {
  if (!config.antinuke.rollback.roles) return;
  try {
    const created = await guild.roles.create({
      name: roleSnapshot.name,
      color: roleSnapshot.color,
      hoist: roleSnapshot.hoist,
      permissions: roleSnapshot.permissions?.bitfield ?? 0n,
      mentionable: roleSnapshot.mentionable,
    });
    logger.security('♻️ Rollback', `Role **${roleSnapshot.name}** recreated`);
    return created;
  } catch (e) {
    console.error('[Anti-Nuke] rollback role:', e.message);
  }
}

// ─── استرجاع روم محذوف من آخر backup (fallback لو مفيش snapshot) ───
async function restoreChannelFromBackup(guild, channelId) {
  const { getAllBackups } = require('./storage');
  const backups = getAllBackups();
  const latest = Object.keys(backups).sort((a, b) => (backups[b].createdAt || 0) - (backups[a].createdAt || 0))[0];
  if (!latest) return;
  const ch = (backups[latest].channels || []).find((c) => c.id === channelId);
  if (!ch) return;
  try {
    const type = ch.type === 2 ? 2 : 0;
    const created = await guild.channels.create({
      name: ch.name,
      type,
      topic: ch.topic,
      nsfw: ch.nsfw,
      parent: ch.parentId,
      permissionOverwrites: (ch.permissionOverwrites || []).map((o) => ({
        id: o.id, allow: BigInt(o.allow), deny: BigInt(o.deny),
      })),
    });
    logger.security('♻️ Rollback (backup)', `Channel **${ch.name}** restored from backup as <#${created.id}>`);
    return created;
  } catch (e) {
    console.error('[Anti-Nuke] restore channel from backup:', e.message);
  }
}

// ─── استرجاع رول محذوف من آخر backup ───
async function restoreRoleFromBackup(guild, roleId) {
  const { getAllBackups } = require('./storage');
  const backups = getAllBackups();
  const latest = Object.keys(backups).sort((a, b) => (backups[b].createdAt || 0) - (backups[a].createdAt || 0))[0];
  if (!latest) return;
  const role = (backups[latest].roles || []).find((r) => r.id === roleId);
  if (!role) return;
  try {
    const created = await guild.roles.create({
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: BigInt(role.permissions || 0),
    });
    logger.security('♻️ Rollback (backup)', `Role **${role.name}** restored from backup`);
    return created;
  } catch (e) {
    console.error('[Anti-Nuke] restore role from backup:', e.message);
  }
}

module.exports = {
  hit, isOwner, isExempt, punish, rollbackChannel, rollbackRole,
  snapshotChannel, snapshotRole, getChannelSnapshot, getRoleSnapshot,
  snapshotAll,
};

// ═══════════════════════════════════════════════
//  Snapshot Store - لحفظ حال الرومات/الرولات للـ rollback
// ═══════════════════════════════════════════════
const channelSnapshots = new Map();
const roleSnapshots = new Map();

function snapshotChannel(channel) {
  if (!channel) return;
  channelSnapshots.set(channel.id, {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    nsfw: channel.nsfw,
    parentId: channel.parentId,
    position: channel.position,
    permissionOverwrites: channel.permissionOverwrites,
  });
}

function getChannelSnapshot(id) {
  return channelSnapshots.get(id);
}

function snapshotRole(role) {
  if (!role) return;
  roleSnapshots.set(role.id, {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    permissions: role.permissions,
    position: role.position,
    mentionable: role.mentionable,
  });
}

function getRoleSnapshot(id) {
  return roleSnapshots.get(id);
}

// ─── Snapshot كامل للسيرفر (كل الرومات والرولات) عند التشغيل ───
async function snapshotAll(guild) {
  channelSnapshots.clear();
  roleSnapshots.clear();
  for (const ch of guild.channels.cache.values()) snapshotChannel(ch);
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue; // skip @everyone
    snapshotRole(role);
  }
  return { channels: channelSnapshots.size, roles: roleSnapshots.size };
}