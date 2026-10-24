const express = require('express');
const router = express.Router();
const storage = require('../../src/storage');
const { isLocked, registerFail, clearAttempts } = require('../middleware');

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// دخول باسم مستخدم + كلمة سر
router.post('/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (isLocked(ip)) return res.redirect('/login?err=locked');

  const user = storage.verifyUser(req.body.username || '', req.body.password || '');
  if (user) {
    clearAttempts(ip);
    req.session.authUser = user; // { username, role }
    storage.pushAudit(user.username, 'تسجيل دخول', '');
    return res.redirect('/');
  }
  registerFail(ip);
  res.redirect('/login?err=1');
});

module.exports = router;
