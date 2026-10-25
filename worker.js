// ══════════════════════════════════════════════════════════════════════════════
//  BEEBOO DASHBOARD — 24/7 Cloud Background Worker & Voice Keep-Alive
//  Optimized for Render / Koyeb / VPS & Local 24/7 Continuous Execution
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const http = require('http');
const storage = require('./src/storage');
const pool = require('./src/bot/pool');
const voiceStay = require('./src/bot/features/voiceStay');
const kryptonLoader = require('./src/bot/kryptonLoader');
const { VoiceConnectionStatus } = require('@discordjs/voice');

// 1. تعيينات القنوات الصوتية الثابتة للـ 9 بوتات
const VOICE_MAP = {
  '1536510357370314812': { channelId: '1536635011162308638', name: "╭・🌴・𝐉𝐮𝐥𝐚𝐢𝐚'𝐚" },
  '1536518247950590032': { channelId: '1536589886889529465', name: '┆・🌅・𝐐𝐨𝐫𝐭𝐮𝐛𝐚' },
  '1536553370502832178': { channelId: '1536589881055117434', name: '┆・🌊・𝐀𝐥 𝐀𝐝𝐚𝐧' },
  '1536612024208068608': { channelId: '1536589878106787920', name: '┆・⛵・𝐑𝐮𝐦𝐚𝐢𝐭𝐡𝐢𝐲𝐚' },
  '1536612088770994176': { channelId: '1536589890299502733', name: '┆・🐚・𝐀𝐥 𝐁𝐢𝐝𝐝𝐚' },
  '1536612140872368248': { channelId: '1536589893000499291', name: '┆・🪸・𝐀𝐥 𝐒𝐮𝐫𝐫𝐚' },
  '1536612213245354094': { channelId: '1536589896700002366', name: '┆・🦐・𝐀𝐥 𝐤𝐡𝐢𝐫𝐚𝐧' },
  '1536612272493953084': { channelId: '1536589899631960134', name: '┆・🐠・𝐁𝐧𝐚𝐢𝐝𝐞𝐫' },
  '1536612331654742128': { channelId: '1536589903301840996', name: '╰・🏖️・𝐁𝐚𝐲𝐚𝐧' },
};

// 2. درع الحماية ضد الانهيارات غير المتوقعة (Crash Shield)
process.on('unhandledRejection', (e) => console.error('[WORKER UNHANDLED REJECTION]', e?.message || e));
process.on('uncaughtException', (e) => console.error('[WORKER UNCAUGHT EXCEPTION]', e?.message || e));

// 3. خادم فحص الصحة البسيط لمنصات الاستضافة السحابية المجانية (Render/Koyeb Free Tier Health Check)
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/' || req.url === '/ping') {
    const bots = storage.getBots();
    const onlineCount = bots.filter((b) => pool.isOnline(b.id)).length;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'healthy',
        service: 'beeboo-bot-worker',
        uptime: Math.floor(process.uptime()),
        botsTotal: bots.length,
        botsOnline: onlineCount,
        timestamp: new Date().toISOString(),
      })
    );
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[WORKER HEALTH SERVER] ✅ Listening on port ${PORT} for Cloud Health Checks`);
});

// 4. دالة التحقق والصيانة الدورية للاتصال بالـ Gateway والرومات الصوتية
async function checkAndMaintainVoice() {
  const bots = storage.getBots();
  let index = 1;

  for (const b of bots) {
    const botId = b.id;
    const targetConfig = VOICE_MAP[botId];
    const targetChannelId = targetConfig?.channelId;
    const channelLabel = targetConfig?.name || targetChannelId || 'Voice Channel';

    let client = pool.get(botId);
    if (!client || !client.isReady()) {
      try {
        console.log(`[BOT ${index}] إعادة ربط "${b.label}" بـ Gateway...`);
        client = await pool.launch(b);
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) {
        console.warn(`[BOT ${index}] 🔴 فشل اتصال "${b.label}": ${e.message}`);
        index++;
        continue;
      }
    }

    const tag = client.user?.tag || b.label;
    const guilds = Array.from(client.guilds.cache.values());

    if (guilds.length === 0) {
      console.warn(`[BOT ${index}] ${b.label} (${tag}) ⚠️ ليس عضواً في أي سيرفر بعد`);
      index++;
      continue;
    }

    let joined = false;
    for (const guild of guilds) {
      try {
        let ch = guild.channels.cache.get(targetChannelId);
        if (!ch) {
          ch = await guild.channels.fetch(targetChannelId).catch(() => null);
        }

        if (ch && (ch.isVoiceBased ? ch.isVoiceBased() : ch.type === 2)) {
          const me = guild.members.me;
          const inVoice = me?.voice?.channelId === ch.id;
          const connReady = client._voiceConn && client._voiceConn.state?.status === VoiceConnectionStatus.Ready;

          if (inVoice && connReady) {
            joined = true;
            break;
          } else {
            console.log(`[BOT ${index}] ${b.label} (${tag}) → دخول الروم الصوتي: ${ch.name} في [${guild.name}]...`);
            storage.updateGuild(botId, guild.id, (g) => {
              g.voiceStay.enabled = true;
              g.voiceStay.channelId = ch.id;
            });
            await voiceStay.joinIfEnabled(client, botId, guild);
            joined = true;
            break;
          }
        }
      } catch (err) {
        console.warn(`[BOT ${index}] خطأ أثناء فحص الروم الصوتي: ${err.message}`);
      }
    }

    if (!joined) {
      console.log(`[BOT ${index}] ${b.label} (${tag}) — الحالة: 🟢 ONLINE في سيرفر [${guilds[0].name}]`);
    }

    index++;
  }
}

// 5. الدورة الرئيسية لإقلاع العامل (Main Worker Startup)
async function startWorker() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  🚀 BEEBOO 24/7 CLOUD BOT WORKER — Starting Engine');
  console.log('══════════════════════════════════════════════════════════════');

  // إقلاع بوت متجر Krypton
  try {
    kryptonLoader.init();
  } catch (err) {
    console.error('[KRYPTON] خطأ إقلاع Krypton:', err.message);
  }

  // إقلاع كل بوتات البوول الـ 9
  console.log('\n[POOL] جارٍ تسجيل دخول البوتات الـ 9 إلى Discord Gateway...');
  await pool.startAll();
  console.log(`[POOL] تم تسجيل دخول ${pool.clients.size}/9 بوت بنجاح ✅\n`);

  // فحص وانضمام أولي
  await checkAndMaintainVoice();

  // تكرار الصيانة وإعادة الاتصال الدوري كل 15 ثانية للتأكد من بقاء البوتات 24/7
  setInterval(async () => {
    try {
      await checkAndMaintainVoice();
    } catch (e) {
      console.error('[VOICE RECHECK ERROR]', e.message);
    }
  }, 15 * 1000);
}

// إيقاف آمن عند استلام إشارات السحابة (SIGTERM / SIGINT)
process.on('SIGTERM', () => {
  console.log('[WORKER] تم استلام إشارة SIGTERM — إغلاق آمن...');
  server.close();
  process.exit(0);
});

startWorker().catch((err) => {
  console.error('[FATAL WORKER ERROR]', err);
  process.exit(1);
});
