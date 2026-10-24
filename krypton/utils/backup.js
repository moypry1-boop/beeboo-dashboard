// ═══════════════════════════════════════════════
//  Backup Utility - نسخة احتياطية كاملة للسيرفر
//  يحفظ بنية السيرفر (رولات + رومات + كاتجوريز + ترتيب)
//  ويمكن استرجاعها في أي وقت / عند الحاجة
// ═══════════════════════════════════════════════

const { ChannelType } = require('discord.js');
const config = require('../config');
const storage = require('./storage');
const { logger } = require('./logger');

// ─── إنشاء نسخة احتياطية ───
async function createBackup(guild, label = 'manual') {
  const categories = [];
  const channels = [];
  const roles = [];

  // ─── الكاتجوريز والرومات ───
  for (const ch of guild.channels.cache.values()) {
    const base = {
      id: ch.id,
      name: ch.name,
      type: ch.type,
      position: ch.position,
      parentId: ch.parentId,
      rawPosition: ch.rawPosition,
    };

    if (ch.type === ChannelType.GuildCategory) {
      categories.push({ ...base, children: [] });
    } else if (ch.isTextBased() || ch.isVoiceBased()) {
      const entry = {
        ...base,
        topic: ch.topic || null,
        nsfw: !!ch.nsfw,
        bitrate: ch.bitrate || null,
        userLimit: ch.userLimit || null,
        rtcRegion: ch.rtcRegion || null,
        rateLimitPerUser: ch.rateLimitPerUser || 0,
        permissionOverwrites: ch.permissionOverwrites.cache.map((o) => ({
          id: o.id,
          allow: o.allow.bitfield.toString(),
          deny: o.deny.bitfield.toString(),
        })),
      };
      channels.push(entry);
    }
  }

  // ─── تجميع الرومات تحت الكاتجوري (للترتيب) ───
  for (const cat of categories) {
    cat.children = channels
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.position - b.position)
      .map((c) => c.id);
  }
  const orphanChannels = channels
    .filter((c) => !c.parentId)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.id);

  // ─── الرولات (باستثناء @everyone) ───
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.id) continue; // skip @everyone
    roles.push({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      mentionable: role.mentionable,
      permissions: role.permissions.bitfield.toString(),
      position: role.position,
    });
  }

  const backup = {
    id: `backup-${Date.now()}`,
    createdAt: Date.now(),
    guildInfo: {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
    },
    categories,
    channels,
    orphanChannels,
    roles: roles.sort((a, b) => b.position - a.position),
  };

  storage.saveBackup(backup.id, backup);

  logger.security('💾 Backup Created', `Server backup created (${label}).`, {
    fields: [
      { name: 'Categories', value: `${categories.length}`, inline: true },
      { name: 'Channels', value: `${channels.length}`, inline: true },
      { name: 'Roles', value: `${roles.length}`, inline: true },
      { name: 'Backup ID', value: backup.id },
    ],
  });

  return backup;
}

// ─── استرجاع نسخة احتياطية ───
async function restoreBackup(guild, backup, client) {
  const results = { rolesCreated: 0, rolesFailed: 0, channelsCreated: 0, channelsFailed: 0 };

  // إنشاء رولات تعريفية أولاً (بما في ذلك الحماية)
  // 1) أنشئ كل الرولات (باستثناء @everyone)
  const roleNameToNew = new Map();
  for (const r of backup.roles) {
    try {
      const newRole = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable,
        permissions: BigInt(r.permissions || 0),
        reason: 'Backup restore',
      });
      roleNameToNew.set(r.name.toLowerCase(), newRole);
      results.rolesCreated++;
    } catch (e) {
      results.rolesFailed++;
    }
  }

  // 2) أنشئ كل الكاتجوريز
  const catIdToNew = new Map();
  for (const cat of backup.categories) {
    try {
      const newCat = await guild.channels.create({
        name: cat.name,
        type: ChannelType.GuildCategory,
        position: cat.position,
        reason: 'Backup restore',
      });
      catIdToNew.set(cat.id, newCat);
    } catch (e) {
      console.error('[Backup] create category:', e.message);
    }
  }

  // 3) أنشئ كل الرومات (داخلها ترتيبها)
  for (const ch of backup.channels) {
    try {
      const parent = ch.parentId ? catIdToNew.get(ch.parentId) : null;
      const options = {
        name: ch.name,
        type: ch.type === ChannelType.GuildVoice || ch.type === 2 ? ChannelType.GuildVoice : ChannelType.GuildText,
        topic: ch.topic,
        nsfw: ch.nsfw,
        bitrate: ch.type === 2 ? ch.bitrate : undefined,
        userLimit: ch.type === 2 ? ch.userLimit : undefined,
        rateLimitPerUser: ch.type === 0 ? ch.rateLimitPerUser : undefined,
        parent: parent ? parent.id : undefined,
        position: ch.position,
        reason: 'Backup restore',
        permissionOverwrites: (ch.permissionOverwrites || []).map((o) => ({
          id: o.id,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
        })),
      };
      // منع overwrites على معرفات قديمة (الرومات المش منشأة فـ rolled back remap)
      await guild.channels.create(options);
      results.channelsCreated++;
    } catch (e) {
      results.channelsFailed++;
      console.error('[Backup] restore channel:', e.message);
    }
  }

  logger.security('♻️ Backup Restored', `Server restored from **${backup.id}**.`, {
    fields: [
      { name: 'Roles', value: `${results.rolesCreated}/${backup.roles.length}`, inline: true },
      { name: 'Channels', value: `${results.channelsCreated}/${backup.channels.length}`, inline: true },
    ],
  });

  return results;
}

// ─── التحديد التلقائي للنسخة الافتراضية ───
async function createAutoBackup(guild) {
  return createBackup(guild, 'auto');
}

module.exports = {
  createBackup,
  restoreBackup,
  createAutoBackup,
};
