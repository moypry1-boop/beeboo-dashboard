const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');

// إنشاء عميل بوت — كل توكن له عميل مستقل
function createClient(token, botId, entry = {}) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates, // للصوت والميوزك
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  client._token = token;
  client._botId = botId; // بنستخدمه في كل الإعدادات (كل بوت لإعداداته)
  client._script = entry.script || '';
  client.spamTracker = new Collection();
  client.raidTracker = new Collection();
  client.raidModeUntil = new Collection();

  // ===== لو البوت ليه سكربت خاص (بوت المتجر مثلاً) — يشتغل السكربت ده بس =====
  if (entry.script) {
    try {
      require(`./scripts/${entry.script}`)(client);
      client.on('error', (e) => console.error(`[CLIENT ${botId}]`, e.message));
      return client;
    } catch (e) {
      console.error(`[SCRIPT ${entry.script}] فشل تحميل سكربت "بوت ${botId}":`, e.message || e);
      // لو السكربت فشل — نكمل بوت عادي عشان يظل شغال
    }
  }

  const events = [
    'ready',
    'guildMemberAdd',
    'guildMemberRemove',
    'messageCreate',
    'interactionCreate',
  ];
  for (const name of events) {
    const fn = require(`./events/${name}`);
    if (name === 'ready') {
      client.once(name, (...args) => fn(...args));
    } else {
      client.on(name, (...args) => fn(...args));
    }
  }

  // أحداث اللوجز (أحداث متعددة في ملف واحد)
  require('./events/logger')(client);

  // الحماية من النيوك + نظام الاقتراحات
  require('./features/antiNuke')(client);
  require('./features/suggestions').register(client);

  // الميوزك + القعود الدائم في الصوتية
  require('./features/music').init(client);
  require('./features/voiceStay')(client);

  // نظام AI — بوت ذكي بيتكلم بالصوت ويرد على الناس (بيشتغل على البوت المحدد بس)
  require('./features/aiAgent').register(client);

  // نظام Streaks للبنات — لايك + عدّاد ستريك على صور الفروم
  require('./features/streaks').register(client);

  // أخطاء الاتصال ما توقّفش البوت
  client.on('error', (e) => console.error(`[CLIENT ${botId}]`, e.message));
  client.on('shardDisconnect', () => console.warn(`[CLIENT ${botId}] الاتصال قطع — جاري إعادة المحاولة تلقائياً`));

  return client;
}

module.exports = { createClient };
