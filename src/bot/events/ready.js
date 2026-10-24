const { REST, Routes } = require('discord.js');
const slash = require('../slash');

module.exports = async function (client) {
  console.log(`[BOT] دخل باسم ${client.user.tag}`);

  client.user.setPresence({
    activities: [{ name: '🖥️ لوحة التحكم | /help', type: 3 }],
    status: 'online',
  });

  // تسجيل أوامر السلاش لكل سيرفر (تشتغل فوراً)
  const rest = new REST().setToken(client._token);
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: slash.commandData }
      );
    } catch (e) {
      console.error(`[SLASH] فشل تسجيل الأوامر في ${guild.name}:`, e.message);
    }
  }
};
