// مصادقة اللوحة: حسابات بصلاحيات (owner > admin > mod) + حماية من التخمين
const ROLE_LEVEL = { mod: 1, admin: 2, owner: 3 };

const MAX_TRIES = 5;
const LOCK_MS = 10 * 60 * 1000;
const attempts = new Map(); // ip -> {count, until}

function isLocked(ip) {
  const a = attempts.get(ip);
  return a && a.until > Date.now();
}
function registerFail(ip) {
  const a = attempts.get(ip) || { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_TRIES) { a.until = Date.now() + LOCK_MS; a.count = 0; }
  attempts.set(ip, a);
}
function clearAttempts(ip) { attempts.delete(ip); }

function requireAuth(req, res, next) {
  if (!req.session?.authUser) {
    if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'سجل دخول الأول' });
    return res.redirect('/login');
  }
  res.locals.authUser = req.session.authUser;
  next();
}

// أقل رول مسموح للوصول
function requireMin(minRole) {
  return (req, res, next) => {
    const role = req.session?.authUser?.role;
    if (!role || ROLE_LEVEL[role] < ROLE_LEVEL[minRole]) {
      if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ error: 'صلاحياتك مش كفاية لهذا الإجراء' });
      return res.status(403).send('صلاحياتك مش كفاية لفتح الصفحة دي.');
    }
    next();
  };
}

module.exports = { requireAuth, requireMin, isLocked, registerFail, clearAttempts, ROLE_LEVEL };
