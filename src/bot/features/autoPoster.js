// الرسائل المجدولة (Auto-Poster) — فحص كل دقيقة
const storage = require('../../storage');

function timeMatches(dailyTime, now) {
  if (!dailyTime || !/^\d{2}:\d{2}$/.test(dailyTime)) return false;
  const [h, m] = dailyTime.split(':').map(Number);
  return now.getHours() === h && now.getMinutes() === m;
}

async function tick(pool) {
  const now = new Date();
  const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

  for (const client of pool.clients.values()) {
    for (const guild of client.guilds.cache.values()) {
      const s = storage.getGuild(client._botId, guild.id);
      let changed = false;

      for (const item of s.autoPoster || []) {
        // وضع الفاصل الزمني
        if (item.everyHours > 0) {
          if (Date.now() - (item.lastSent || 0) < item.everyHours * 3600 * 1000) continue;
        }
        // وضع الوقت اليومي
        else if (item.dailyTime) {
          if (!timeMatches(item.dailyTime, now)) continue;
          const dayKey = minuteKey.split('-').slice(0, 3).join('-');
          if (item.lastDay === dayKey) continue; // بعت النهاردة خلاص
          item.lastDay = dayKey;
        } else {
          continue;
        }

        const ch = guild.channels.cache.get(item.channelId);
        if (ch?.isTextBased()) {
          await ch.send({ content: item.content }).catch(() => {});
          item.lastSent = Date.now();
          changed = true;
        }
      }

      if (changed) storage.updateGuild(client._botId, guild.id, (st) => { st.autoPoster = s.autoPoster; });
    }
  }
}

module.exports = { tick };
