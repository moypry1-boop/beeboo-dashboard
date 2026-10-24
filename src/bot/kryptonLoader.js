// ═══════════════════════════════════════════════
//  KRYPTON Store Bot Loader — يشغّل بوت المتجر كعملية
//  مستقلة جانبية داخل نفس خدمة اللوحة (24/7)
//  ⚠️ مش بيمس أو يعدّل أي ملف في مجلد krypton
// ═══════════════════════════════════════════════
const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');

// حل المسارات ديناميكياً لتفادي أخطاء المسارات في البيئات السحابية والـ Serverless
function resolvePaths() {
  const possibleRoots = [
    process.cwd(),
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
    path.resolve(__dirname),
    '/app',
  ];

  for (const root of possibleRoots) {
    const candidateBotDir = path.resolve(root, 'krypton');
    const candidateEntry = path.join(candidateBotDir, 'index.js');
    if (fs.existsSync(candidateEntry)) {
      return {
        projectRoot: root,
        botDir: candidateBotDir,
        botEntry: candidateEntry,
        dataFile: path.join(candidateBotDir, 'data', 'botdata.json'),
      };
    }
  }

  // Fallback إذا لم يتم العثور على index.js في المرشحين
  const fallbackRoot = path.resolve(__dirname, '..', '..');
  const fallbackBotDir = path.resolve(fallbackRoot, 'krypton');
  return {
    projectRoot: fallbackRoot,
    botDir: fallbackBotDir,
    botEntry: path.join(fallbackBotDir, 'index.js'),
    dataFile: path.join(fallbackBotDir, 'data', 'botdata.json'),
  };
}

const { projectRoot: PROJECT_ROOT, botDir: BOT_DIR, botEntry: BOT_ENTRY, dataFile: DATA_FILE } = resolvePaths();

// نسخة احتياطية على الـ volume المستمر (بيعيش على restarts)
const VOLUME_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || (process.env.NODE_ENV === 'production' && !process.env.VERCEL ? '/app/data' : '');
const VOLUME_DATA = VOLUME_DIR ? path.join(VOLUME_DIR, 'krypton', 'botdata.json') : '';

let child = null;
let lastRestart = 0;
let saveTimer = null;

// نجيب أحدث بيانات من الـ volume (قبل التشغيل)
function restoreFromVolume() {
  if (!VOLUME_DATA) return;
  try {
    if (fs.existsSync(VOLUME_DATA)) {
      const fresh = fs.readFileSync(VOLUME_DATA, 'utf8');
      if (fresh && fresh.trim().startsWith('{')) {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, fresh, 'utf8');
        console.log('[KRYPTON] رجّعت بيانات botdata من الـ volume ✅');
      }
    }
  } catch (e) {
    console.error('[KRYPTON] فشل استرجاع البيانات من الـ volume:', e.message);
  }
}

// نحفظ نسخة على الـ volume (كل 5 ثواني)
function saveToVolume() {
  if (!VOLUME_DATA || !fs.existsSync(DATA_FILE)) return;
  try {
    fs.mkdirSync(path.dirname(VOLUME_DATA), { recursive: true });
    fs.copyFileSync(DATA_FILE, VOLUME_DATA);
  } catch (e) {
    console.error('[KRYPTON] فشل حفظ نسخة على الـ volume:', e.message);
  }
}
function scheduleVolumeSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToVolume, 5000);
}

function start() {
  if (!fs.existsSync(BOT_ENTRY)) {
    console.error(`[KRYPTON] ملف التشغيل غير موجود: ${BOT_ENTRY}`);
    return;
  }

  // لو البوت اتقفل قبل كده خليناه يستريح 5 ثواني قبل ما نرجّعه
  const wait = Math.max(0, (lastRestart + 5000) - Date.now());

  setTimeout(() => {
    try {
      child = fork(BOT_ENTRY, [], {
        cwd: BOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        env: process.env,
      });

      if (!child) return;

      // لوجات بوت المتجر بتظهر في لوجات اللوحة ببادئة [KRYPTON]
      child.stdout?.on('data', (d) => {
        const lines = String(d).trim().split('\n').filter(Boolean);
        for (const l of lines) console.log(`[KRYPTON] ${l}`);
      });
      child.stderr?.on('data', (d) => {
        const lines = String(d).trim().split('\n').filter(Boolean);
        for (const l of lines) console.error(`[KRYPTON] ${l}`);
      });

      child.on('exit', (code, signal) => {
        console.error(`[KRYPTON] اتقفل (code=${code} signal=${signal}) — بترجّعه تلقائيًا بعد 5 ثواني`);
        child = null;
        lastRestart = Date.now();
        if (!process.env.VERCEL) {
          start();
        }
      });

      child.on('error', (err) => {
        console.error('[KRYPTON] خطأ في العملية الفرعية:', err.message);
      });
    } catch (e) {
      console.error('[KRYPTON] تعذر تشغيل العملية الفرعية:', e.message);
    }
  }, wait);
}

// تشغيل البوت مرة واحدة عند إقلاع اللوحة
function init() {
  if (process.env.KRYPTON_DISABLED === '1') {
    console.log('[KRYPTON] معطّل بواسطة KRYPTON_DISABLED=1 — مش هيشتغل');
    return;
  }
  if (process.env.VERCEL) {
    console.log('[KRYPTON] بيئة Vercel Serverless مُكتشفة — تم تجاوز تشغيل العملية الفرعية المستمرة');
    return;
  }
  console.log('[KRYPTON] بوت متجر KRYPTON بيشتغل كعملية مستقلة...');

  try {
    // نتأكد إن مجلد البيانات موجود (ولو مش موجود بننشئه)
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

    // لو مش في بيانات (ملف مش موجود والـ volume فاضي) → نستعيد من النسخة المرفوعة
    // مع الكود (seed) — عشان بياناتك تبدأ من الأول مش من الصفر
    if (!fs.existsSync(DATA_FILE) || (fs.statSync(DATA_FILE).size || 0) < 3) {
      if (!VOLUME_DATA || !fs.existsSync(VOLUME_DATA)) {
        const seedCandidates = [
          path.join(__dirname, 'seed', 'botdata.json'),
          path.join(PROJECT_ROOT, 'src', 'bot', 'seed', 'botdata.json'),
          path.join(PROJECT_ROOT, 'krypton', 'data', 'botdata.json'),
        ];
        const seed = seedCandidates.find((p) => fs.existsSync(p));
        if (seed) {
          fs.copyFileSync(seed, DATA_FILE);
          console.log('[KRYPTON] استعدت البيانات من النسخة المرفوعة (seed) ✅');
        }
      }
    }

    restoreFromVolume();          // نجيب أحدث بيانات من الـ volume (إن وجد)
    // بنراقب الملف عشان نحفظ نسخ على الـ volume — من غير ما نوقف حاجة لو فشل
    try {
      fs.watch(DATA_FILE, { persistent: false }, () => scheduleVolumeSave());
    } catch (e) {
      console.error('[KRYPTON] تعذّر مراقبة البيانات (مش مشكلة) — هنحفظ دوري:', e.message);
    }
    setInterval(saveToVolume, 10 * 1000);
  } catch (e) {
    // لو أي حاجة في الاسترجاع فشلت، نكمّل عادي — البوت هيكتب ملفات جديدة
    console.error('[KRYPTON] مشكلة في تجهيز البيانات (مش وقف):', e.message);
  }

  start();
}

// حلقة فحص وبقاء دائم في الرومات الصوتية لجميع بوتات البوول الـ 9
function startPoolVoiceKeepAlive(pool) {
  if (!pool) return;
  const voiceStay = require('./features/voiceStay');
  const storage = require('../storage');

  setInterval(async () => {
    try {
      const bots = storage.getBots();
      for (const bot of bots) {
        const client = pool.get(bot.id);
        if (!client || !client.isReady()) continue;

        for (const guild of client.guilds.cache.values()) {
          try {
            await voiceStay.joinIfEnabled(client, bot.id, guild);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[POOL VOICE KEEP-ALIVE ERROR]', err.message);
    }
  }, 20 * 1000);
}

module.exports = { init, startPoolVoiceKeepAlive, resolvePaths, PROJECT_ROOT, BOT_DIR, BOT_ENTRY, DATA_FILE };
