// routes/api-secret.js — endpoints اللوحة السرية
const express = require('express');
const router = express.Router();
const storage = require('../../src/storage');
const pool = require('../../src/bot/pool');
const tts = require('../../src/bot/features/tts');

// middleware: لازم يكون مسجّل دخول
function requireAuth(req, res, next) {
  if (!req.session?.authUser) return res.status(401).json({ error: 'سجل دخول الأول' });
  next();
}

// middleware: لازم يكون فتح اللوحة السرية
function requireSecret(req, res, next) {
  if (!req.session?.secretUnlocked) return res.status(403).json({ error: 'اللوحة السرية مقفلة' });
  next();
}

// الحالة: هل كلمة السر السرية محددة؟
router.get('/status', requireAuth, (req, res) => {
  res.json({ ok: true, configured: storage.isSecretConfigured(), unlocked: !!req.session.secretUnlocked });
});

// إعداد كلمة السر (أول مرة بس)
router.post('/setup', requireAuth, (req, res) => {
  if (storage.isSecretConfigured()) return res.status(400).json({ error: 'تم إعدادها قبل كده' });
  const pw = String(req.body.password || '').trim();
  if (pw.length < 4) return res.status(400).json({ error: 'كلمة السر لازم 4 حروف على الأقل' });
  storage.setSecretPassword(pw);
  storage.pushAudit(req.session.authUser.username, '🔑 إعداد كلمة سر سرية', '');
  res.json({ ok: true });
});

// فتح اللوحة السرية بكلمة السر
router.post('/unlock', requireAuth, (req, res) => {
  const pw = String(req.body.password || '');
  if (!storage.checkSecretPassword(pw)) return res.status(403).json({ error: 'كلمة السر غلط' });
  req.session.secretUnlocked = true;
  storage.pushAudit(req.session.authUser.username, '🔓 فتح اللوحة السرية', '');
  res.json({ ok: true });
});

// قفل اللوحة
router.post('/lock', requireAuth, (req, res) => {
  req.session.secretUnlocked = false;
  res.json({ ok: true });
});

// البوتات المتاحة + الرومات الصوتية + كل القنوات الصوتية المتاحة
router.get('/bots', requireAuth, requireSecret, (req, res) => {
  const bots = storage.getBots().map((b) => {
    const c = pool.get(b.id);
    const guilds = c ? c.guilds.cache.map((g) => {
      const me = g.members.me;
      const inVoice = me?.voice?.channelId;
      const ch = inVoice ? g.channels.cache.get(inVoice) : null;
      // كل القنوات الصوتية في السيرفر
      const voiceChannels = g.channels.cache
        .filter((ch) => ch.type === 2) // GUILD_VOICE
        .map((vc) => ({ id: vc.id, name: vc.name, members: vc.members?.size || 0 }));
      return {
        id: g.id,
        name: g.name,
        voiceChannel: ch ? { id: ch.id, name: ch.name } : null,
        voiceChannels,
      };
    }) : [];
    return { id: b.id, label: b.label, online: !!c?.isReady(), guilds };
  });
  res.json({ ok: true, bots });
});

// نطق بالصوت
router.post('/say', requireAuth, requireSecret, async (req, res) => {
  try {
    const { botId, guildId, text, voice } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'اكتب النص الأول' });
    const c = pool.get(String(botId));
    if (!c || !c.isReady()) return res.status(400).json({ error: 'البوت مش شغال' });
    const guild = c.guilds.cache.get(String(guildId));
    if (!guild) return res.status(400).json({ error: 'السيرفر مش موجود' });

    // ولّد الصوت
    const { buffer } = await tts.synthesize(text, voice || 'female');

    // شغّله في الروم (backstage — بدون رد)
    tts.playInVoice(guild, buffer).catch(() => {});

    storage.pushAudit(req.session.authUser.username, '🗣️ نطق بالصوت', String(text).slice(0, 60));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== دخول بوت واحد في روم صوتية محددة =====
router.post('/join-voice', requireAuth, requireSecret, async (req, res) => {
  try {
    const { botId, guildId, channelId } = req.body;
    if (!botId || !channelId) return res.status(400).json({ error: 'botId, channelId لازم تكون موجودة' });
    const c = pool.get(String(botId));
    if (!c || !c.isReady()) return res.status(400).json({ error: 'البوت مش شغال' });

    // لو guildId مش محدد، ندور على السيرفر اللي فيه الروم دي
    let gid = guildId;
    let guild;
    if (gid) {
      guild = c.guilds.cache.get(String(gid));
    } else {
      // ندور في كل السيرفرات على الروم الصوتية دي
      for (const g of c.guilds.cache.values()) {
        if (g.channels.cache.has(String(channelId))) {
          guild = g;
          gid = g.id;
          break;
        }
      }
    }
    if (!guild) return res.status(400).json({ error: 'السيرفر/الروم مش موجود للبوت ده' });
    const channel = guild.channels.cache.get(String(channelId));
    if (!channel || channel.type !== 2) return res.status(400).json({ error: 'الروم الصوتية مش موجودة' });

    const vs = require('../../src/bot/features/voiceStay');
    storage.updateGuild(String(botId), String(gid), (s) => {
      s.voiceStay.enabled = true;
      s.voiceStay.channelId = String(channelId);
    });
    await vs.joinIfEnabled(c, String(botId), guild);

    const botLabel = storage.getBots().find(b => b.id === String(botId))?.label || botId;
    storage.pushAudit(req.session.authUser.username, '🔊 دخول روم صوتية', `${botLabel} → ${guild.name} → ${channel.name}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== دخول كل البوتات في روم صوتية محددة =====
router.post('/join-voice-all', requireAuth, requireSecret, async (req, res) => {
  try {
    const { guildId, channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId لازم يكون موجود' });

    const vs = require('../../src/bot/features/voiceStay');
    const results = [];

    for (const entry of storage.getBots()) {
      const c = pool.get(entry.id);
      if (!c || !c.isReady()) { results.push({ bot: entry.label, ok: false, error: 'البوت مش شغال' }); continue; }

      // لو guildId مش محدد، ندور في كل السيرفرات
      let gid = guildId;
      let guild;
      if (gid) {
        guild = c.guilds.cache.get(String(gid));
      } else {
        for (const g of c.guilds.cache.values()) {
          if (g.channels.cache.has(String(channelId))) {
            guild = g;
            gid = g.id;
            break;
          }
        }
      }
      if (!guild) { results.push({ bot: entry.label, ok: false, error: 'الروم مش موجود للبوت ده' }); continue; }
      const channel = guild.channels.cache.get(String(channelId));
      if (!channel || channel.type !== 2) { results.push({ bot: entry.label, ok: false, error: 'مش روم صوتية' }); continue; }

      storage.updateGuild(entry.id, String(gid), (s) => {
        s.voiceStay.enabled = true;
        s.voiceStay.channelId = String(channelId);
      });

      try {
        await vs.joinIfEnabled(c, entry.id, guild);
        results.push({ bot: entry.label, ok: true });
      } catch (e) {
        results.push({ bot: entry.label, ok: false, error: e.message });
      }
    }

    storage.pushAudit(req.session.authUser.username, '🔊 دخول كل البوتات لروم صوتية', `${channelId} (${results.filter(r=>r.ok).length} نجح)`);
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== batch: كل بوت في روم مختلف =====
router.post('/join-voice-batch', requireAuth, requireSecret, async (req, res) => {
  try {
    const { assignments } = req.body; // [{botId, channelId}]
    if (!Array.isArray(assignments) || !assignments.length) return res.status(400).json({ error: 'محتاج assignments مصفوفة' });

    const vs = require('../../src/bot/features/voiceStay');
    const results = [];

    for (const { botId, channelId } of assignments) {
      if (!botId || !channelId) { results.push({ bot: botId, ok: false, error: 'botId أو channelId ناقص' }); continue; }

      const c = pool.get(String(botId));
      if (!c || !c.isReady()) { results.push({ bot: botId, ok: false, error: 'البوت مش شغال' }); continue; }

      // ندور على السيرفر اللي فيه الروم دي
      let guild;
      for (const g of c.guilds.cache.values()) {
        if (g.channels.cache.has(String(channelId))) {
          guild = g;
          break;
        }
      }
      if (!guild) { results.push({ bot: botId, ok: false, error: 'الروم مش موجود للبوت ده' }); continue; }

      const channel = guild.channels.cache.get(String(channelId));
      if (!channel || channel.type !== 2) { results.push({ bot: botId, ok: false, error: 'مش روم صوتية' }); continue; }

      storage.updateGuild(String(botId), guild.id, (s) => {
        s.voiceStay.enabled = true;
        s.voiceStay.channelId = String(channelId);
      });

      try {
        await vs.joinIfEnabled(c, String(botId), guild);
        const botLabel = storage.getBots().find(b => b.id === String(botId))?.label || botId;
        results.push({ bot: botLabel, ok: true, guild: guild.name, channel: channel.name });
      } catch (e) {
        results.push({ bot: botId, ok: false, error: e.message });
      }
    }

    storage.pushAudit(req.session.authUser.username, '🔊 batch دخول رومات صوتية', `${results.filter(r=>r.ok).length} نجح من ${assignments.length}`);
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== خروج بوت من الروم الصوتية =====
router.post('/leave-voice', requireAuth, requireSecret, async (req, res) => {
  try {
    const { botId, guildId } = req.body;
    const c = pool.get(String(botId));
    if (!c || !c.isReady()) return res.status(400).json({ error: 'البوت مش شغال' });
    const guild = c.guilds.cache.get(String(guildId));
    if (!guild) return res.status(400).json({ error: 'السيرفر مش موجود' });

    storage.updateGuild(String(botId), String(guildId), (s) => {
      s.voiceStay.enabled = false;
      s.voiceStay.channelId = '';
    });
    storage.clearVoiceAssignment(String(botId));
    const vs = require('../../src/bot/features/voiceStay');
    await vs.leaveNow(c, String(botId), guild);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ===== حفظ خريطة الصوت (أي بوت يروح في أي روم) =====
router.get('/voice-map', requireAuth, requireSecret, (req, res) => {
  res.json({ ok: true, map: storage.getVoiceMap() });
});

router.post('/voice-map', requireAuth, requireSecret, (req, res) => {
  const map = req.body.map;
  if (!map || typeof map !== 'object') return res.status(400).json({ error: 'محتاج map object' });
  storage.setVoiceMap(map);
  res.json({ ok: true });
});

// ===== batch: كل بوت في روم مختلف حسب الـ voiceMap المحفوظة =====
router.post('/join-voice-from-map', requireAuth, requireSecret, async (req, res) => {
  try {
    const vs = require('../../src/bot/features/voiceStay');
    const results = [];
    const bots = storage.getBots();

    for (const entry of bots) {
      const channelId = storage.getVoiceAssignment(entry.id);
      if (!channelId) { results.push({ bot: entry.label, ok: false, error: 'مفيش روم محدد' }); continue; }

      const c = pool.get(entry.id);
      if (!c || !c.isReady()) { results.push({ bot: entry.label, ok: false, error: 'البوت مش شغال' }); continue; }

      // ندور على السيرفر اللي فيه الروم دي
      let guild;
      for (const g of c.guilds.cache.values()) {
        if (g.channels.cache.has(String(channelId))) {
          guild = g;
          break;
        }
      }
      if (!guild) { results.push({ bot: entry.label, ok: false, error: 'الروم مش موجود' }); continue; }

      storage.updateGuild(entry.id, guild.id, (s) => {
        s.voiceStay.enabled = true;
        s.voiceStay.channelId = String(channelId);
      });

      try {
        await vs.joinIfEnabled(c, entry.id, guild);
        const ch = guild.channels.cache.get(channelId);
        results.push({ bot: entry.label, ok: true, guild: guild.name, channel: ch?.name || channelId });
      } catch (e) {
        results.push({ bot: entry.label, ok: false, error: e.message });
      }
    }

    storage.pushAudit(req.session.authUser.username, '🔊 دخول من الخريطة', `${results.filter(r=>r.ok).length} نجح`);
    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.requireSecret = requireSecret;
