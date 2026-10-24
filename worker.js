// ══════════════════════════════════════════════════════════════════════════════
//  BEEBOO DASHBOARD — 24/7 Persistent Bot Pool & Voice Keep-Alive Worker
//  Runs all 9 pool bots + Krypton bot continuously with voice auto-reconnect
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const path = require('path');
const storage = require('./src/storage');
const pool = require('./src/bot/pool');
const voiceStay = require('./src/bot/features/voiceStay');
const kryptonLoader = require('./src/bot/kryptonLoader');
const { VoiceConnectionStatus } = require('@discordjs/voice');

// تعيينات القنوات الصوتية الثابتة للـ 9 بوتات
const VOICE_MAP = {
  '1536510357370314812': { channelId: '1536635011162308638', name: "Julaia'a (الجليعة)" },
  '1536518247950590032': { channelId: '1536589886889529465', name: 'Qortuba (قرطبة)' },
  '1536553370502832178': { channelId: '1536589881055117434', name: 'Al Adan (العدان)' },
  '1536612024208068608': { channelId: '1536589878106787920', name: 'Voice 4 (صوتي 4)' },
  '1536612088770994176': { channelId: '1536589890299502733', name: 'Voice 5 (صوتي 5)' },
  '1536612140872368248': { channelId: '1536589893000499291', name: 'Voice 6 (صوتي 6)' },
  '1536612213245354094': { channelId: '1536589896700002366', name: 'Voice 7 (صوتي 7)' },
  '1536612272493953084': { channelId: '1536589899631960134', name: 'Voice 8 (صوتي 8)' },
  '1536612331654742128': { channelId: '1536589903301840996', name: 'Voice 9 (صوتي 9)' },
};

process.on('unhandledRejection', (e) => console.error('[WORKER UNHANDLED]', e?.message || e));
process.on('uncaughtException', (e) => console.error('[WORKER UNCAUGHT]', e?.message || e));

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  🚀 BEEBOO BOT WORKER — Starting All 9 Bots & Voice Engine');
  console.log('══════════════════════════════════════════════════════════════');

  // 1. تشغيل بوت متجر Krypton
  try {
    kryptonLoader.init();
  } catch (err) {
    console.error('[KRYPTON] خطأ في تشغيل Krypton:', err.message);
  }

  // 2. تشغيل جميع بوتات البوول الـ 9
  console.log('\n[POOL] جارٍ تسجيل دخول البوتات الـ 9 إلى Discord Gateway...');
  await pool.startAll();

  console.log(`\n[POOL] تم تسجيل دخول ${pool.clients.size} بوت بنجاح ✅`);

  // 3. حلقة الحفاظ على الاتصال الصوتي الدائم (Continuous Voice Keep-Alive Loop)
  console.log('\n[VOICE] جارٍ بدء محرك التواجد الدائم في الرومات الصوتية (24/7 Keep-Alive)...\n');

  async function checkAndJoinVoice() {
    const bots = storage.getBots();
    let index = 1;

    for (const b of bots) {
      const botId = b.id;
      const targetConfig = VOICE_MAP[botId];
      const targetChannelId = targetConfig?.channelId;
      const channelLabel = targetConfig?.name || targetChannelId || 'Unknown Channel';

      let client = pool.get(botId);
      if (!client || !client.isReady()) {
        try {
          client = await pool.launch(b);
        } catch (e) {
          console.log(`[BOT ${index}] ${b.label} (ID: ${botId}) — الحالة: 🔴 غير متصل بـ Gateway (${e.message})`);
          index++;
          continue;
        }
      }

      const tag = client.user?.tag || 'Discord Bot';
      const guilds = Array.from(client.guilds.cache.values());

      if (guilds.length === 0) {
        console.log(`[BOT ${index}] ${b.label} (${tag}) — الحالة: 🟢 ONLINE (Gateway) | ⚠️ ليس عضواً في أي سيرفر حتى الآن`);
        console.log(`         👉 رابط الدعوة: https://discord.com/oauth2/authorize?client_id=${client.user?.id || botId}&scope=bot%20applications.commands&permissions=8`);
        index++;
        continue;
      }

      // البحث عن السيرفر الذي يحتوي على الروم الصوتي المحدد
      let joined = false;
      for (const guild of guilds) {
        try {
          // جلب القنوات للتأكد من وجودها
          let ch = guild.channels.cache.get(targetChannelId);
          if (!ch) {
            ch = await guild.channels.fetch(targetChannelId).catch(() => null);
          }

          if (ch && (ch.isVoiceBased ? ch.isVoiceBased() : ch.type === 2)) {
            const me = guild.members.me;
            const inVoice = me?.voice?.channelId === ch.id;
            const connReady = client._voiceConn && client._voiceConn.state?.status === VoiceConnectionStatus.Ready;

            if (inVoice && connReady) {
              console.log(`[BOT ${index}] ${b.label} (${tag}) — الحالة: 🟢 ONLINE | 🔊 جالس في الروم الصوتي: ${ch.name} في ${guild.name} ✅`);
              joined = true;
              break;
            } else {
              console.log(`[BOT ${index}] ${b.label} (${tag}) — جارٍ الانضمام إلى الروم: ${ch.name} (${guild.name})...`);
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
          console.warn(`[BOT ${index}] خطأ في فحص الروم الصوتي: ${err.message}`);
        }
      }

      if (!joined) {
        console.log(`[BOT ${index}] ${b.label} (${tag}) — الحالة: 🟢 ONLINE في سيرفر [${guilds[0].name}] | الروم المستهدف: ${channelLabel}`);
      }

      index++;
    }
  }

  // تنفيذ الفحص فوراً
  await checkAndJoinVoice();

  // تكرار الفحص والصيانة الدورية كل 15 ثانية للتأكد من بقاء جميع البوتات في الرومات 24/7
  setInterval(async () => {
    try {
      await checkAndJoinVoice();
    } catch (e) {
      console.error('[VOICE LOOP ERROR]', e.message);
    }
  }, 15 * 1000);
}

main().catch((err) => {
  console.error('[FATAL WORKER ERROR]', err);
  process.exit(1);
});
