// ═══════════════════════════════════════════════
//  Permission Check Utility - نظام صلاحيات متدرج
//  المستويات (من الأدنى للأعلى):
//    everyone = 0 : أي عضو
//    staff    = 1 : رول الستاف
//    admin    = 2 : رول الأدمن
//    owner    = 3 : المالك (أعلى صلاحية)
// ═══════════════════════════════════════════════

const config = require('../config');

// ─── ترتيب المستويات رقميًا ───
const LEVELS = {
  everyone: 0,
  staff: 1,
  admin: 2,
  owner: 3,
};

const LEVEL_LABELS = {
  0: '👤 الجميع',
  1: '🟡 الستاف',
  2: '🔴 الأدمن',
  3: '⭐ المالك',
};

function isOwner(member) {
  if (!member) return false;
  // مالك السيرفر الفعلي
  if (member.guild && member.guild.ownerId && member.id === member.guild.ownerId) return true;
  // المالك من config
  const oid = config.ids.ownerId;
  return oid && oid !== 'OWNER_USER_ID_HERE' && member.id === oid;
}

function isAdmin(member) {
  if (isOwner(member)) return true;
  if (!member) return false;
  return (
    member.roles.cache.has(config.ids.adminRole) ||
    member.permissions.has('Administrator')
  );
}

function isStaff(member) {
  if (isAdmin(member)) return true;
  if (!member) return false;
  return (
    member.roles.cache.has(config.ids.staffRole) ||
    member.permissions.has('Administrator')
  );
}

// ─── مستوى العضو الحالي ───
function getLevel(member) {
  if (isOwner(member)) return LEVELS.owner;
  if (isAdmin(member)) return LEVELS.admin;
  if (isStaff(member)) return LEVELS.staff;
  return LEVELS.everyone;
}

// ─── هل المستوى يكفي؟ ───
function meetsLevel(member, requiredLevel) {
  const required = typeof requiredLevel === 'string' ? LEVELS[requiredLevel] : requiredLevel;
  return getLevel(member) >= required;
}

function hasPermission(member, required) {
  if (required === 'owner') return isOwner(member);
  if (required === 'admin') return isAdmin(member);
  if (required === 'staff') return isStaff(member);
  return true;
}

module.exports = {
  isAdmin,
  isStaff,
  isOwner,
  getLevel,
  meetsLevel,
  hasPermission,
  LEVELS,
  LEVEL_LABELS,
};
