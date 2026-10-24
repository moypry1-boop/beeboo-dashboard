// الإحصائيات: عدّادات يومية + تاريخ آخر 30 يوم
const storage = require('../../storage');

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// زيادة عدّاد (يتم من أحداث البوت)
function bump(botId, guildId, field) {
  storage.updateGuild(botId, guildId, (s) => {
    const key = todayKey();
    if (s.stats.dateKey !== key) {
      // يوم جديد — نحفظ القديم في التاريخ ونبدأ من الصفر
      if (s.stats.dateKey) {
        s.stats.history.push({
          date: s.stats.dateKey,
          msgs: s.stats.msgsToday,
          joins: s.stats.joinsToday,
        });
        if (s.stats.history.length > 30) s.stats.history = s.stats.history.slice(-30);
      }
      s.stats.msgsToday = 0; s.stats.joinsToday = 0; s.stats.leavesToday = 0;
      s.stats.dateKey = key;
    }
    s.stats[field] = (s.stats[field] || 0) + 1;
  });
}

// ترحيل اليوم القديم عند النداء الدوري
function rollover(pool) {
  for (const client of pool.clients.values()) {
    for (const guild of client.guilds.cache.values()) {
      const s = storage.getGuild(client._botId, guild.id);
      if (s.stats.dateKey !== todayKey() && s.stats.dateKey) {
        storage.updateGuild(client._botId, guild.id, (st) => {
          st.stats.history.push({ date: st.stats.dateKey, msgs: st.stats.msgsToday, joins: st.stats.joinsToday });
          if (st.stats.history.length > 30) st.stats.history = st.stats.history.slice(-30);
          st.stats.msgsToday = 0; st.stats.joinsToday = 0; st.stats.leavesToday = 0;
          st.stats.dateKey = todayKey();
        });
      }
    }
  }
}

module.exports = { bump, rollover, todayKey };
