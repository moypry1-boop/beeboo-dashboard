// ═══════════════════════════════════════════════
//  Command Guard - مراقبة صلاحيات الأوامر (مركزي)
//  كل أمر له مستوى لازم. الفحص يتم في interactionCreate
//  قبل تنفيذ الأمر، فما يهم الأمنيع أي حقن في ملفات الأوامر.
//
//  المستويات: everyone | staff | admin | owner
// ═══════════════════════════════════════════════

const { getLevel, LEVELS, LEVEL_LABELS } = require('./permissions');

// ─── خريطة الأوامر → المستوى الأدنى المطلوب ───
// عدّل القيم هنا زي ما تحب (owner > admin > staff).
const COMMAND_LEVELS = {
  // ── أعلى صلاحية (المالك فقط) — الأكثر خطورة/خصوصية ──
  backup: 'owner',
  strip: 'owner',
  download: 'owner',
  bill: 'owner',
  lockdown: 'owner',

  // ── الأدمن ──
  addstock: 'admin',
  removestock: 'admin',
  broadcast: 'admin',
  giveaway: 'admin',
  postsetup: 'admin',
  analytics: 'admin',

  // ── الستاف ──
  'send-verify': 'staff',
  'send-ticket': 'staff',
  'send-roles': 'staff',
  ticket: 'staff',
  warn: 'staff',
  warns: 'staff',
  clearwarns: 'staff',
  kick: 'staff',
  ban: 'staff',
  unban: 'staff',
  mute: 'staff',
  unmute: 'staff',
  clear: 'staff',
  checkin: 'staff',
  checkout: 'staff',

  // ── الجميع (افتراضي) — خدمات العميل الأساسية للمتجر ──
  // هذه الفئة مقصودة: بدونها ما فيش شراء/عرض للمنتجات
  // stock, review, help, stats, level, leaderboard, birthday,
  // remindme, suggest, poll, post  ← تبقى عامة (مش أوامر إدارية)
};

// ─── هل يتطلب هذا الأمر صلاحية على الإطلاق؟ ───
function requiredLevelFor(commandName) {
  return COMMAND_LEVELS[commandName] || 'everyone';
}

// ─── هل عمر العضو بيعتبر "إدارة" (أي صلاحية إدارية)؟ ───
function isAdminLevel(member) {
  return getLevel(member) >= LEVELS.staff;
}

// ─── فحص مركزي: هل يسمح للعضو بتنفيذ الأمر؟ ───
function canExecute(member, commandName) {
  const req = requiredLevelFor(commandName);
  const level = getLevel(member);
  const reqNum = LEVELS[req];
  return level >= reqNum;
}

// ─── رسالة الخطأ ───
function deniedMessage(commandName) {
  const req = requiredLevelFor(commandName);
  return `🚫 الأمر **${commandName}** متاح للـ **${LEVEL_LABELS[LEVELS[req]]}** فقط.`;
}

module.exports = {
  canExecute,
  requiredLevelFor,
  deniedMessage,
  isAdminLevel,
  COMMAND_LEVELS,
};
