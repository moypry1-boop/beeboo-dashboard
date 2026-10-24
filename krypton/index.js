// ═══════════════════════════════════════════════
//  KRYPTON Store Bot - Main Entry
// ═══════════════════════════════════════════════

const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  ActivityType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { setClient } = require('./utils/logger');

// ─── إنشاء البوت ───
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
    Partials.Reaction,
  ],
});

// ─── Collections ───
client.commands = new Collection();
client.buttons = new Collection();
client.selectMenus = new Collection();
client.modals = new Collection();
setClient(client);

// ─── تحميل الملفات ───
function loadFolder(folderName, collection) {
  const folderPath = path.join(__dirname, 'handlers', folderName);
  if (!fs.existsSync(folderPath)) return;

  const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const handler = require(path.join(folderPath, file));
    if (handler.name) {
      collection.set(handler.name, handler);
      console.log(`  ✓ Loaded ${folderName}: ${handler.name}`);
    }
  }
}

console.log('\n🔥 KRYPTON Store Bot - Loading...\n');
loadFolder('commands', client.commands);
loadFolder('buttons', client.buttons);
loadFolder('selectMenus', client.selectMenus);
loadFolder('modals', client.modals);

// ─── تحميل الأحداث ───
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
    console.log(`  ✓ Loaded event: ${event.name}`);
  }
}

// ───amelogin ───
client.once('ready', () => {
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  🔥 KRYPTON Bot is Online!`);
  console.log(`  📌 Logged in as: ${client.user.tag}`);
  console.log(`  🏠 Servers: ${client.guilds.cache.size}`);
  console.log(`  👥 Users: ${client.users.cache.size}`);
  console.log(`══════════════════════════════════════════\n`);

  client.user.setPresence({
    activities: [
      {
        name: 'KRYPTON Store 🛡️',
        type: ActivityType.Watching,
      },
    ],
    status: 'online',
  });

  // ─── فحص الجيف أواي كل 20 ثانية ───
  const { checkGiveaways } = require('./utils/giveaways');
  setInterval(() => checkGiveaways(client), 20000);

  // ─── المجدول (تذكيرات/أعياد/جديد) ───
  const { startSchedulers } = require('./utils/scheduler');
  startSchedulers(client);

  // ─── إنشاء كاتجوريز التيكت تلقائيًا (لكل نوع قسمه) ───
  const { ensureTicketCategories } = require('./utils/ticketCategories');
  ensureTicketCategories(client).catch((err) =>
    console.error('[Tickets] ensureTicketCategories error:', err.message)
  );

  // ─── النسخ الاحتياطي التلقائي عند التشغيل ───
  const { createAutoBackup } = require('./utils/backup');
  const guild = client.guilds.cache.first();
  if (guild) {
    createAutoBackup(guild).catch((err) =>
      console.error('[Backup] auto backup error:', err.message)
    );

    // ─── Snapshot فوري لكل الرومات والرولات للـ rollback السريع ───
    const { snapshotAll } = require('./utils/antinuke');
    snapshotAll(guild).catch((e) => console.error('[AntiNuke] snapshotAll:', e.message));

    // ─── إنشاء روم الـ downloads تلقائيًا ───
    const { ensureDownloadsChannel } = require('./utils/downloads');
    ensureDownloadsChannel(guild).catch((e) => console.error('[Downloads] ensure channel:', e.message));
  }

  // ─── نسخة احتياطية دورية كل 6 ساعات ───
  setInterval(() => {
    const g = client.guilds.cache.first();
    if (g) createAutoBackup(g).catch((e) => console.error('[Backup] periodic:', e.message));
  }, 6 * 60 * 60 * 1000);
});

// ─── تسجيل الدخول ───
client.login(config.token).catch(err => {
  console.error('❌ Failed to login:', err.message);
  process.exit(1);
});

// ─── Error Handling ───
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
