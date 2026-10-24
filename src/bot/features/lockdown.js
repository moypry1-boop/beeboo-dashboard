// قفل/فتح السيرفر بالكامل (Lockdown)
const { PermissionFlagsBits } = require('discord.js');
const storage = require('../../storage');

async function setLock(client, botId, guild, lock) {
  const everyone = guild.roles.everyone;
  let done = 0;
  for (const channel of guild.channels.cache.values()) {
    if (![0, 5].includes(channel.type)) continue; // نصية + إعلانات
    try {
      const current = channel.permissionOverwrites.cache.get(everyone.id);
      await channel.permissionOverwrites.edit(everyone.id,
        lock ? { SendMessages: false } : { SendMessages: null },
        { reason: lock ? 'Lockdown من اللوحة' : 'فك القفل من اللوحة' }
      );
      done++;
    } catch { /* قناة مستثناة */ }
  }
  storage.updateGuild(botId, guild.id, (s) => { s.lockedDown = lock; });
  return done;
}

module.exports = { setLock };
