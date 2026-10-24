// ═══════════════════════════════════════════════
//  Storage Utility - تخزين JSON بسيط
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'botdata.json');

const defaults = {
  xp: {},               // { userId: { xp, lastMsg } }
  giveaways: [],        // [ { messageId, channelId, prize, endsAt, winners, entrants: [], announced } ]
  suggestions: {},      // { messageId: { authorId, status } }
  reviews: {},          // { userId: [ { rating, text, at } ] }
  warnings: {},         // { userId: [ { modId, reason, at } ] }
  stock: {},            // { productName: { stock, price, note, lastAlerted } }
  reminders: [],        // [ { userId, at, text } ]
  birthdays: {},        // { userId: 'DD-MM' }
  analytics: {},        // { 'YYYY-MM-DD': { users: { id: n }, channels: { id: n } } }
  lockdown: null,       // { channels: [ids] }
  counting: { highScore: 0, lastNumber: 0, lastUserId: null, streak: 0 },
  welcome: {},          // { userId: { rulesAcceptedAt } }
  invitedCodes: {},     // { inviteCode: { uses } } (غير مستخدمة حاليًا)
  attendance: {},       // { date: { userId: { checkIn, checkOut, totalMs } } }
  posts: {},            // { userId: { channelId, totalPosts, lastPostAt } }
  manualApprovals: {},  // { messageId: { userId, channelId } } — طلبات التوثيق اليدوي
  ticketCategoryMap: {}, // { typeId: categoryId } — كاتجوري كل نوع تيكت
  backups: {},       // { [backupId]: backupObject } — نسخ احتياطية للسيرفر
  protectedUsers: [], // قائمة المستخدمين اللي عليهم حماية (lockdown/ghost)
  downloadsChannelId: '', // روم الـ downloads (يتعرف تلقائيًا)
};

let data = null;

function ensureLoaded() {
  if (data) return;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    data = { ...defaults, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
  } catch {
    data = JSON.parse(JSON.stringify(defaults));
  }
}

function save() {
  ensureLoaded();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[Storage] Failed to save:', err.message);
  }
}

// ─── XP / Leveling ───
function xpForLevel(level) {
  return 100 * level;
}

function getLevelInfo(totalXp) {
  let level = 1;
  let xp = totalXp;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level++;
  }
  return {
    level,
    currentXp: xp,
    needed: xpForLevel(level),
    totalXp,
  };
}

function addXp(userId, amount) {
  ensureLoaded();
  if (!data.xp[userId]) data.xp[userId] = { xp: 0, lastMsg: 0 };
  const before = getLevelInfo(data.xp[userId].xp);
  data.xp[userId].xp += amount;
  data.xp[userId].lastMsg = Date.now();
  const after = getLevelInfo(data.xp[userId].xp);
  save();
  return { before, after, leveledUp: after.level > before.level };
}

function getXp(userId) {
  ensureLoaded();
  const u = data.xp[userId];
  return u ? getLevelInfo(u.xp) : { level: 1, currentXp: 0, needed: 100, totalXp: 0 };
}

function canEarnXp(userId, cooldown) {
  ensureLoaded();
  const u = data.xp[userId];
  if (!u) return true;
  return Date.now() - u.lastMsg >= cooldown;
}

function getLeaderboard(limit = 10) {
  ensureLoaded();
  return Object.entries(data.xp)
    .map(([id, u]) => ({ id, ...getLevelInfo(u.xp) }))
    .sort((a, b) => b.totalXp - a.totalXp)
    .slice(0, limit);
}

// ─── Giveaways ───
function getGiveaways() {
  ensureLoaded();
  return data.giveaways;
}

function addGiveaway(gw) {
  ensureLoaded();
  data.giveaways.push(gw);
  save();
}

function updateGiveaway(messageId, fn) {
  ensureLoaded();
  const idx = data.giveaways.findIndex(g => g.messageId === messageId);
  if (idx === -1) return null;
  data.giveaways[idx] = fn(data.giveaways[idx]);
  const gw = data.giveaways[idx];
  save();
  return gw;
}

function removeGiveaway(messageId) {
  ensureLoaded();
  data.giveaways = data.giveaways.filter(g => g.messageId !== messageId);
  save();
}

function addEntrant(messageId, userId) {
  ensureLoaded();
  const gw = data.giveaways.find(g => g.messageId === messageId);
  if (!gw) return { ok: false, reason: 'not_found' };
  if (gw.entrants.includes(userId)) return { ok: false, reason: 'already' };
  gw.entrants.push(userId);
  save();
  return { ok: true, gw };
}

// ─── Suggestions ───
function setSuggestion(messageId, authorId, status = 'pending') {
  ensureLoaded();
  data.suggestions[messageId] = { authorId, status };
  save();
}

function getSuggestion(messageId) {
  ensureLoaded();
  return data.suggestions[messageId] || null;
}

function updateSuggestion(messageId, status) {
  ensureLoaded();
  if (!data.suggestions[messageId]) return null;
  data.suggestions[messageId].status = status;
  save();
  return data.suggestions[messageId];
}

// ─── Reviews ───
function addReview(userId, rating, text) {
  ensureLoaded();
  if (!data.reviews[userId]) data.reviews[userId] = [];
  data.reviews[userId].push({ rating, text, at: Date.now() });
  save();
}

function lastReview(userId) {
  ensureLoaded();
  const list = data.reviews[userId];
  if (!list || list.length === 0) return null;
  return list[list.length - 1];
}

function averageRating() {
  ensureLoaded();
  let total = 0, count = 0;
  for (const list of Object.values(data.reviews)) {
    for (const r of list) { total += r.rating; count++; }
  }
  return count === 0 ? 0 : total / count;
}

// ─── Warnings ───
function addWarning(userId, modId, reason) {
  ensureLoaded();
  if (!data.warnings[userId]) data.warnings[userId] = [];
  data.warnings[userId].push({ modId, reason, at: Date.now() });
  save();
  return data.warnings[userId];
}

function getWarnings(userId) {
  ensureLoaded();
  return data.warnings[userId] || [];
}

function clearWarnings(userId) {
  ensureLoaded();
  delete data.warnings[userId];
  save();
}

// ─── Stock ───
function getStock() {
  ensureLoaded();
  return data.stock;
}

function addStock(product, amount, price, note) {
  ensureLoaded();
  if (!data.stock[product]) data.stock[product] = { stock: 0, price: 0, note: '', lastAlerted: false };
  if (price !== undefined && price !== null) data.stock[product].price = price;
  if (note) data.stock[product].note = note;
  data.stock[product].stock += amount;
  data.stock[product].lastAlerted = false;
  save();
  return data.stock[product];
}

function removeStock(product, amount) {
  ensureLoaded();
  if (!data.stock[product]) return null;
  data.stock[product].stock = Math.max(0, data.stock[product].stock - amount);
  save();
  return data.stock[product];
}

function setStockAlerted(product) {
  ensureLoaded();
  if (data.stock[product]) {
    data.stock[product].lastAlerted = true;
    save();
  }
}

// ─── Reminders ───
function getReminders() {
  ensureLoaded();
  return data.reminders;
}

function addReminder(userId, at, text) {
  ensureLoaded();
  data.reminders.push({ userId, at, text });
  save();
}

function removeReminderByIndex(idx) {
  ensureLoaded();
  if (idx > -1) {
    data.reminders.splice(idx, 1);
    save();
  }
}

// ─── Birthdays ───
function setBirthday(userId, dayMonth) {
  ensureLoaded();
  data.birthdays[userId] = dayMonth;
  save();
}

function getBirthdays() {
  ensureLoaded();
  return data.birthdays;
}

function getBirthday(userId) {
  ensureLoaded();
  return data.birthdays[userId] || null;
}

// ─── Analytics ───
function trackMessage(userId, channelId) {
  ensureLoaded();
  const day = new Date().toISOString().slice(0, 10);
  if (!data.analytics[day]) data.analytics[day] = { users: {}, channels: {} };
  data.analytics[day].users[userId] = (data.analytics[day].users[userId] || 0) + 1;
  data.analytics[day].channels[channelId] = (data.analytics[day].channels[channelId] || 0) + 1;
  save();
}

function getAnalytics(days = 7) {
  ensureLoaded();
  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  const dayKeys = Object.keys(data.analytics).filter(d => new Date(d).getTime() >= start);
  const totals = { users: {}, channels: {}, total: 0 };
  for (const key of dayKeys) {
    const bucket = data.analytics[key];
    for (const [uid, n] of Object.entries(bucket.users)) totals.users[uid] = (totals.users[uid] || 0) + n;
    for (const [cid, n] of Object.entries(bucket.channels)) totals.channels[cid] = (totals.channels[cid] || 0) + n;
  }
  totals.total = Object.values(totals.users).reduce((a, b) => a + b, 0);
  return totals;
}

// ─── Lockdown ───
function setLockdown(snapshot) {
  ensureLoaded();
  data.lockdown = snapshot;
  save();
}

function getLockdown() {
  ensureLoaded();
  return data.lockdown;
}

// ─── Counting ───
function getCounting() {
  ensureLoaded();
  if (!data.counting) data.counting = { highScore: 0, lastNumber: 0, lastUserId: null, streak: 0 };
  return data.counting;
}

function saveCounting(c) {
  ensureLoaded();
  data.counting = c;
  save();
}

// ─── Welcome ───
function acceptRules(userId) {
  ensureLoaded();
  data.welcome[userId] = { rulesAcceptedAt: Date.now() };
  save();
}

function hasAcceptedRules(userId) {
  ensureLoaded();
  return !!data.welcome[userId];
}

// ─── Attendance (حضور الستاف) ───
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function checkIn(userId) {
  ensureLoaded();
  const key = todayKey();
  if (!data.attendance[key]) data.attendance[key] = {};
  if (!data.attendance[key][userId]) data.attendance[key][userId] = { checkIn: null, checkOut: null, totalMs: 0 };
  data.attendance[key][userId].checkIn = Date.now();
  save();
  return data.attendance[key][userId];
}

function checkOut(userId) {
  ensureLoaded();
  const key = todayKey();
  const rec = data.attendance[key]?.[userId];
  if (!rec || !rec.checkIn) return null;
  if (!rec.checkOut) {
    rec.totalMs += Date.now() - rec.checkIn;
  }
  rec.checkOut = Date.now();
  save();
  return rec;
}

function isCheckedIn(userId) {
  ensureLoaded();
  const key = todayKey();
  const rec = data.attendance[key]?.[userId];
  return rec && rec.checkIn && !rec.checkOut;
}

function getAttendanceForPeriod(days = 7) {
  ensureLoaded();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const result = {}; // userId -> { totalMs, sessions }
  for (const [dateKey, day] of Object.entries(data.attendance)) {
    if (new Date(dateKey).getTime() < start.getTime()) continue;
    for (const [userId, rec] of Object.entries(day)) {
      if (!result[userId]) result[userId] = { totalMs: 0, sessions: 0 };
      result[userId].totalMs += rec.totalMs || 0;
      result[userId].sessions += 1;
    }
  }
  return result;
}

// ─── Posts (بوستات) ───
function getPostInfo(userId) {
  ensureLoaded();
  if (!data.posts[userId]) data.posts[userId] = { channelId: null, totalPosts: 0, lastPostAt: 0 };
  return data.posts[userId];
}

function countActivePostChannels() {
  ensureLoaded();
  return Object.values(data.posts).filter((p) => p && p.channelId).length;
}

function setPostChannel(userId, channelId) {
  ensureLoaded();
  if (!data.posts[userId]) data.posts[userId] = { channelId: null, totalPosts: 0, lastPostAt: 0 };
  data.posts[userId].channelId = channelId;
  save();
  return data.posts[userId];
}

function incrementPost(userId) {
  ensureLoaded();
  if (!data.posts[userId]) data.posts[userId] = { channelId: null, totalPosts: 0, lastPostAt: 0 };
  data.posts[userId].totalPosts += 1;
  data.posts[userId].lastPostAt = Date.now();
  save();
  return data.posts[userId];
}

// ─── Manual Approvals (طلبات التوثيق اليدوي) ───
function saveManualApproval(messageId, info) {
  ensureLoaded();
  data.manualApprovals[messageId] = info;
  save();
  return data.manualApprovals[messageId];
}

function getManualApproval(messageId) {
  ensureLoaded();
  return data.manualApprovals[messageId] || null;
}

function removeManualApproval(messageId) {
  ensureLoaded();
  delete data.manualApprovals[messageId];
  save();
}

// ─── Invite Tracking (كاش الدعوات لتحديد من دعى العضو) ───
function saveInviteState(codes) {
  ensureLoaded();
  // codes: { [code]: { uses, inviterId } }
  data.invitedCodes = codes;
  save();
}

function getInviteState() {
  ensureLoaded();
  return data.invitedCodes || {};
}

// ─── الوصول العام للبيانات (للملفات التي تحتاج حقول ديناميكية) ───
function getRaw() {
  ensureLoaded();
  return data;
}

function setRaw(patch) {
  ensureLoaded();
  Object.assign(data, patch);
  save();
}

// ─── Backup Management ───
function saveBackup(id, backup) {
  ensureLoaded();
  data.backups[id] = backup;
  save();
  return backup;
}

function getBackup(id) {
  ensureLoaded();
  return data.backups[id] || null;
}

function listBackups() {
  ensureLoaded();
  return data.backups || {};
}

function getAllBackups() {
  ensureLoaded();
  return data.backups || {};
}

// ─── Protected Users (معافين من الحماية — المالك/الستاف الأعلى) ───
function getProtectedUsers() {
  ensureLoaded();
  return data.protectedUsers || [];
}

function addProtectedUser(userId) {
  ensureLoaded();
  if (!data.protectedUsers.includes(userId)) data.protectedUsers.push(userId);
  save();
}

function removeProtectedUser(userId) {
  ensureLoaded();
  data.protectedUsers = (data.protectedUsers || []).filter((id) => id !== userId);
  save();
}

function isProtectedUser(userId) {
  ensureLoaded();
  return (data.protectedUsers || []).includes(userId);
}

module.exports = {
  addXp, getXp, canEarnXp, getLevelInfo, getLeaderboard,
  getGiveaways, addGiveaway, updateGiveaway, removeGiveaway, addEntrant,
  setSuggestion, getSuggestion, updateSuggestion,
  addReview, lastReview, averageRating,
  addWarning, getWarnings, clearWarnings,
  getStock, addStock, removeStock, setStockAlerted,
  getReminders, addReminder, removeReminderByIndex,
  setBirthday, getBirthdays, getBirthday,
  trackMessage, getAnalytics,
  setLockdown, getLockdown,
  getCounting, saveCounting,
  acceptRules, hasAcceptedRules,
  checkIn, checkOut, isCheckedIn, getAttendanceForPeriod,
  getPostInfo, setPostChannel, incrementPost, countActivePostChannels,
  saveManualApproval, getManualApproval, removeManualApproval,
  saveInviteState, getInviteState,
  getRaw, setRaw,
  saveBackup, getBackup, listBackups, getAllBackups,
  getProtectedUsers, addProtectedUser, removeProtectedUser, isProtectedUser,
};