// تخزين بسيط بملفات JSON - بدون أي مكتبات خارجية
// يدعم: بوتات متعددة + إعدادات لكل (بوت, سيرفر) + كلمة سر اللوحة
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_SETTINGS, mergeDefaults } = require('./defaults');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let db = { panel: null, panelUsers: [], auditLog: [], bots: [], guilds: {} };
try {
  if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) {
  console.error('[STORAGE] ملف البيانات تالف، هبدأ من جديد:', e.message);
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
      console.error('[STORAGE] فشل الحفظ:', e.message);
    }
  }, 150);
}

// ================= كلمة سر اللوحة =================
function initPassword(plainFromEnv) {
  // لو db.json موجود وفيه password محفوظ، نستخدمه
  // لو مش موجود (Railway restart مسحه)، نستخدم ADMIN_PASSWORD من env
  if (!db.panel) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(plainFromEnv || 'admin123', salt, 64).toString('hex');
    db.panel = { salt, hash, isDefault: !plainFromEnv };
    save();
    if (!plainFromEnv) console.warn('[PANEL] كلمة السر الافتراضية: admin123 — غيّرها من اللوحة فوراً!');
  }
}
function isDefaultPassword() { return Boolean(db.panel?.isDefault); }
function checkPassword(plain) {
  if (!db.panel) return false;
  const hash = crypto.scryptSync(String(plain), db.panel.salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(db.panel.hash));
  } catch { return false; }
}
function setPassword(newPlain) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.panel = { salt, hash: crypto.scryptSync(String(newPlain), salt, 64).toString('hex'), isDefault: false };
  save();
}

// ================= البوتات (حتى 100) =================
const DEFAULT_POOL_BOTS = [
  { id: '1536510357370314812', label: 'بوت 1 (صوتي)' },
  { id: '1536518247950590032', label: 'بوت 2 (صوتي)' },
  { id: '1536553370502832178', label: 'بوت 3 (صوتي)' },
  { id: '1536612024208068608', label: 'بوت 4 (صوتي)' },
  { id: '1536612088770994176', label: 'بوت 5 (صوتي)' },
  { id: '1536612140872368248', label: 'بوت 6 (صوتي)' },
  { id: '1536612213245354094', label: 'بوت 7 (صوتي)' },
  { id: '1536612272493953084', label: 'بوت 8 (صوتي)' },
  { id: '1536612331654742128', label: 'بوت 9 (صوتي)' },
];

function getBots() {
  const existingBots = Array.isArray(db.bots) ? [...db.bots] : [];

  // دمج البوتات الـ 9 إن لم تكن مسجلة بالفعل
  for (const defaultBot of DEFAULT_POOL_BOTS) {
    if (!existingBots.some((b) => b.id === defaultBot.id)) {
      existingBots.push({
        ...defaultBot,
        token: '',
        addedAt: Date.now(),
      });
    }
  }

  return existingBots.map((b, index) => {
    // 1. قراءة التوكن مباشرة من متغيرات البيئة BOT_TOKEN_1 إلى BOT_TOKEN_9
    const envTokenByIndex = process.env[`BOT_TOKEN_${index + 1}`];
    // 2. قراءة التوكن بواسطة معرّف البوت BOT_TOKEN_<botId>
    const envTokenById = process.env[`BOT_TOKEN_${b.id}`];
    // 3. التوكن العام البديل BOT_TOKEN أو KRYPTON_BOT_TOKEN
    const fallbackToken = process.env.BOT_TOKEN || process.env.KRYPTON_BOT_TOKEN || '';

    const resolvedToken = (envTokenByIndex || envTokenById || b.token || fallbackToken || '').trim();
    return {
      ...b,
      token: resolvedToken,
    };
  });
}
function getBot(id) { return getBots().find((b) => b.id === id); }
function saveBot(entry) {
  db.bots = getBots().filter((b) => b.id !== entry.id);
  db.bots.push(entry);
  save();
}
function deleteBot(id) {
  db.bots = getBots().filter((b) => b.id !== id);
  // امسح إعدادات سيرفراته كمان
  for (const key of Object.keys(db.guilds)) {
    if (key.startsWith(id + '_')) delete db.guilds[key];
  }
  save();
}

// ================= إعدادات السيرفرات =================
const gkey = (botId, guildId) => `${botId}_${guildId}`;

function getGuild(botId, guildId) {
  const raw = db.guilds[gkey(botId, guildId)] || {};
  const merged = mergeDefaults(raw, DEFAULT_SETTINGS);
  merged.warnings = raw.warnings || {};
  merged.customCommands = Array.isArray(raw.customCommands) ? raw.customCommands : [];
  return merged;
}

function updateGuild(botId, guildId, mutator) {
  const s = getGuild(botId, guildId);
  mutator(s);
  db.guilds[gkey(botId, guildId)] = s;
  save();
  return s;
}

// ================= حسابات اللوحة (مالك/أدمن/مشرف) =================
function hashPassword(plain, salt) {
  return crypto.scryptSync(String(plain), salt, 64).toString('hex');
}

function initUsers(envPassword) {
  if (!Array.isArray(db.panelUsers)) db.panelUsers = [];
  if (db.panelUsers.length === 0) {
    const salt = crypto.randomBytes(16).toString('hex');
    db.panelUsers.push({
      username: 'admin',
      hash: hashPassword(envPassword || 'admin123', salt),
      salt,
      role: 'owner', // owner | admin | mod
      createdAt: Date.now(),
    });
    save();
    if (!envPassword) console.warn('[PANEL] حساب المالك الافتراضي: admin / admin123 — غيّر كلمة السر فوراً!');
  }
}

function findUser(username) {
  return (db.panelUsers || []).find((u) => u.username === String(username).toLowerCase().trim());
}

function verifyUser(username, password) {
  const u = findUser(username);
  if (!u) return null;
  try {
    if (crypto.timingSafeEqual(Buffer.from(hashPassword(password, u.salt)), Buffer.from(u.hash))) {
      return { username: u.username, role: u.role };
    }
  } catch { /* ignore */ }
  return null;
}

function createUserPanel(username, password, role) {
  username = String(username).toLowerCase().trim();
  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) throw new Error('اسم المستخدم: حروف إنجليزية وأرقام فقط (3-20)');
  if (findUser(username)) throw new Error('الاسم موجود بالفعل');
  if (!password || String(password).length < 6) throw new Error('كلمة السر لازم 6 حروف على الأقل');
  if (!['mod', 'admin'].includes(role)) throw new Error('الرول لازم admin أو mod');
  const salt = crypto.randomBytes(16).toString('hex');
  db.panelUsers.push({ username, hash: hashPassword(password, salt), salt, role, createdAt: Date.now() });
  save();
}

function deleteUserPanel(username) {
  const u = findUser(username);
  if (!u) throw new Error('مش موجود');
  if (u.role === 'owner') {
    const owners = db.panelUsers.filter((x) => x.role === 'owner').length;
    if (owners <= 1) throw new Error('مينفعش تمسح آخر مالك');
  }
  db.panelUsers = db.panelUsers.filter((x) => x.username !== username);
  save();
}

function changeUserPassword(username, oldPass, newPass) {
  const u = findUser(username);
  if (!u) throw new Error('الحساب مش موجود');
  try {
    crypto.timingSafeEqual(Buffer.from(hashPassword(oldPass, u.salt)), Buffer.from(u.hash));
  } catch { throw new Error('كلمة السر الحالية غلط'); }
  if (hashPassword(oldPass, u.salt) !== u.hash) throw new Error('كلمة السر الحالية غلط');
  if (!newPass || String(newPass).length < 6) throw new Error('الجديدة لازم 6 حروف على الأقل');
  u.salt = crypto.randomBytes(16).toString('hex');
  u.hash = hashPassword(newPass, u.salt);
  save();
}

function listUsersSafe() {
  return (db.panelUsers || []).map((u) => ({ username: u.username, role: u.role, createdAt: u.createdAt }));
}

// ================= سجل عمليات اللوحة =================
function pushAudit(user, action, details) {
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  db.auditLog.push({ at: Date.now(), user: user || '؟', action, details: details || '' });
  if (db.auditLog.length > 500) db.auditLog = db.auditLog.slice(-500);
  save();
}
function getAudit(limit = 200) {
  return [...(db.auditLog || [])].reverse().slice(0, limit);
}

// ================= كلمة السر السرية (Easter Egg) =================
function isSecretConfigured() { return Boolean(db.secretPass); }
function checkSecretPassword(plain) {
  if (!db.secretPass) return false;
  const hash = crypto.scryptSync(String(plain), db.secretPass.salt, 64).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(db.secretPass.hash)); }
  catch { return false; }
}
function setSecretPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.secretPass = { salt, hash: crypto.scryptSync(String(plain), salt, 64).toString('hex') };
  save();
}

// ================= خريطة الصوت =================
function getVoiceMap() { return db.voiceMap || {}; }
function setVoiceMap(map) { db.voiceMap = map; save(); }
function getVoiceAssignment(botId) { return db.voiceMap?.[botId] || null; }
function setVoiceAssignment(botId, channelId) {
  if (!db.voiceMap) db.voiceMap = {};
  db.voiceMap[botId] = channelId;
  save();
}
function clearVoiceAssignment(botId) {
  if (db.voiceMap) { delete db.voiceMap[botId]; save(); }
}

module.exports = {
  initPassword, checkPassword, setPassword, isDefaultPassword,
  initUsers, verifyUser, findUser, createUserPanel, deleteUserPanel,
  changeUserPassword, listUsersSafe,
  pushAudit, getAudit,
  getBots, getBot, saveBot, deleteBot,
  getGuild, updateGuild, save,
  setSecretPassword, checkSecretPassword, isSecretConfigured,
  getVoiceMap, setVoiceMap, getVoiceAssignment, setVoiceAssignment, clearVoiceAssignment,
};
