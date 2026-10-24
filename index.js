require('dotenv').config();
const config = require('./src/config');
const storage = require('./src/storage');
const pool = require('./src/bot/pool');

// فحص UDP السريع — مهم عشان نعرف هل ديسكورد الصوتي هيشتغل على Railway أصلاً
// ملاحظة: الـ endpoint الحقيقي بيظهر في VOICE_SERVER_UPDATE — هنا مجرد فحص DNS
// تشخيص UDP الحقيقي بيظهر في لوجات [VOICE DBG] من الاتصال الفعلي
function udpProbe() {
  const dgram = require('dgram');
  const dns = require('dns');
  dns.lookup('discord.media', (err, addr) => {
    if (err) {
      console.log('[UDP PROBE] ❌ DNS discord.media فشل: ' + err.message);
      return;
    }
    console.log(`[UDP PROBE] ✅ DNS discord.media = ${addr} — نبدأ اختبار UDP عبر endpoint حقيقي`);
    const s = dgram.createSocket('udp4');
    let done = false;
    const finish = (ok, msg) => { if (!done) { done = true; console.log(`[UDP PROBE] ${ok ? '✅' : '❌'} ${msg}`); try { s.close(); } catch {} } };
    s.on('error', (e) => finish(false, 'سوكيت UDP فشل: ' + e.message));
    s.on('message', () => finish(true, 'UDP شغال (رد وصل!)'));
    s.bind(() => {
      // أول باكيت IP discovery — بدون الحاجة لـ session حقيقي هيتجاهل بس بنشوف لو في رد
      const msg = Buffer.alloc(9);
      s.send(msg, 443, addr, (err2) => {
        if (err2) { finish(false, 'مش قادر يبعت UDP: ' + err2.message); return; }
        console.log('[UDP PROBE] ❓ اتبعت UDP للـ endpoint — بنستنى رد 4 ثواني...');
        setTimeout(() => finish(false, 'مفيش رد UDP خلال 4 ثواني — غالباً المسار ده محجوب'), 4000);
      });
    });
  });
}

async function main() {
  // درع الحماية: خطأ في بوت أو رسالة ما يوقّفش البرنامج كله
  process.on('unhandledRejection', (e) => console.error('[UNHANDLED]', e?.message || e));
  process.on('uncaughtException', (e) => console.error('[UNCAUGHT]', e?.message || e));

  // نسخة مكتبة الصوت الفعلية — مهم جداً للتشخيص (DAVE)
  try {
    const vv = require('@discordjs/voice');
    console.log(`[BOOT] @discordjs/voice version = ${vv.version}`);
    const dv = require('distube');
    console.log(`[BOOT] distube version = ${dv.version}`);
  } catch (e) {
    console.log('[BOOT] فشل قراءة إصدار المكتبات:', e.message);
  }

  // فحص UDP (فقط لو مش على Vercel)
  if (!process.env.VERCEL) {
    udpProbe();
  }

  // كلمة سر اللوحة (أول مرة: من .env أو admin123)
  storage.initPassword(config.adminPassword);

  // حسابات اللوحة (أول مرة: admin / admin123 أو من .env)
  storage.initUsers(config.adminPassword);

  // لو حاطط توكن في .env ومفيش بوتات لسه → ضيفه كأول بوت تلقائياً
  if (!process.env.VERCEL && config.seedBotToken && storage.getBots().length === 0) {
    console.log('[POOL] ضافت أول بوت من .env ...');
    try {
      const info = await pool.add('بوت 1', config.seedBotToken);
      console.log(`[POOL] تم ✅ (${info.label})`);
    } catch (e) {
      console.error('[POOL] توكن .env مش شغال:', e.message);
    }
  }

  // نبدأ اللوحة الأول (تشتغل حتى لو مفيش بوتات)
  const startDashboard = require('./dashboard/server');
  const app = await startDashboard();

  // بوت متجر KRYPTON (في البيئات الداعمة)
  try {
    require('./src/bot/kryptonLoader').init();
  } catch (e) {
    console.error('[KRYPTON] فشل تشغيل البوت:', e.message);
  }

  // محرك الـ Keep-Alive الدائم (Self-Pinging Loop كل 3 دقائق + فحص البوتات والرومات الصوتية)
  startKeepAliveLoop();

  // المهمات الدورية: السحبات + الرسائل المجدولة + ترحيل الإحصائيات (في البيئات المستمرة)
  if (!process.env.VERCEL) {
    const giveaways = require('./src/bot/features/giveaways');
    const autoPoster = require('./src/bot/features/autoPoster');
    const stats = require('./src/bot/features/stats');
    setInterval(() => {
      giveaways.tick(pool).catch((e) => console.error('[TICK gw]', e.message));
      autoPoster.tick(pool).catch((e) => console.error('[TICK ap]', e.message));
      stats.rollover(pool);
    }, 30 * 1000);
  }

  // وضع اختبار سريع للإقلاع
  if (process.env.BOOT_TEST === '1') {
    setTimeout(() => {
      console.log('[BOOT TEST] تمام، الإقلاع نجح ✅');
      process.exit(0);
    }, 6000);
  }

  return app;
}

let keepAliveStarted = false;
function startKeepAliveLoop() {
  if (keepAliveStarted) return;
  keepAliveStarted = true;

  const PING_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
  const baseUrl = (process.env.BASE_URL || `http://localhost:${config.port || 3000}`).replace(/\/$/, '');

  console.log(`[KEEP-ALIVE] 🔄 تشغيل محرك Keep-Alive الدوري (كل 3 دقائق) — المستهدف: ${baseUrl}`);

  const runKeepAliveCycle = async () => {
    try {
      // 1. فحص وتأكيد اتصال جميع بوتات البوول الـ 9 بالـ Gateway وبالرومات الصوتية
      const { verifyAndKeepAlivePool } = require('./src/bot/voiceEngine');
      const results = await verifyAndKeepAlivePool();
      const activeCount = Array.isArray(results) ? results.filter((r) => r.online).length : 0;
      const voiceCount = Array.isArray(results) ? results.filter((r) => r.voiceStatus === 'connected_ready' || r.voiceStatus === 'rejoined').length : 0;
      console.log(`[KEEP-ALIVE] 🤖 فحص البوتات: ${activeCount}/9 أونلاين | 🔊 رومات صوتية: ${voiceCount}/9 نشطة`);

      // 2. إرسال Self-Ping عبر HTTP لمنع السيرفر من الدخول في وضع الخمول (Sleep/Idle)
      if (baseUrl && (baseUrl.startsWith('http://') || baseUrl.startsWith('https://'))) {
        const pingUrl = `${baseUrl}/api/keepalive`;
        const res = await fetch(pingUrl, {
          method: 'GET',
          headers: { 'User-Agent': 'Beeboo-KeepAlive-SelfPing/1.0' },
        }).catch((err) => ({ ok: false, status: err.message }));
        console.log(`[KEEP-ALIVE] 🌐 نتيجة Self-Ping (${pingUrl}): ${res.status || 'OK'}`);
      }
    } catch (e) {
      console.error('[KEEP-ALIVE ERROR]', e.message);
    }
  };

  // دورة فحص أولية بعد 3 ثواني
  setTimeout(runKeepAliveCycle, 3000);

  // تكرار دوري مستمر كل 3 دقائق
  return setInterval(runKeepAliveCycle, PING_INTERVAL_MS);
}

let appPromise = null;
function getApp() {
  if (!appPromise) {
    appPromise = main();
  }
  return appPromise;
}

if (require.main === module) {
  main().catch((e) => {
    console.error('[FATAL]', e);
    process.exit(1);
  });
}

// تصدير المعالج لدعم Vercel Serverless
module.exports = async (req, res) => {
  const app = await getApp();
  return app(req, res);
};
