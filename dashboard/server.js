const path = require('path');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const config = require('../src/config');
const storage = require('../src/storage');

module.exports = function startDashboard() {
  return new Promise((resolve) => {
    const app = express();

    // ===== Security Headers =====
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://cdn.jsdelivr.net"],
          connectSrc: ["'self'", "ws:", "wss:"],
          mediaSrc: ["'self'", "blob:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // ===== PERSISTENT KEEP-ALIVE & VOICE MONITORING ENDPOINT =====
    // يسمح لـ Vercel Cron وخدمات المراقبة بإنعاش العمليات والتحقق من رومات الصوت الـ 9
    app.all(['/api/keepalive', '/ping'], async (req, res) => {
      try {
        const { verifyAndKeepAlivePool } = require('../src/bot/voiceEngine');
        const botsStatus = await verifyAndKeepAlivePool();
        const activeBots = Array.isArray(botsStatus) ? botsStatus.filter(b => b.online).length : 0;
        const inVoice = Array.isArray(botsStatus) ? botsStatus.filter(b => b.voiceStatus === 'connected_ready' || b.voiceStatus === 'rejoined').length : 0;
        return res.json({
          ok: true,
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          botsActive: activeBots,
          botsInVoice: inVoice,
          details: botsStatus,
        });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    });

    // ===== Global Rate Limiting =====
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 2000, // لوحة شخصية — حد سخي عشان ما يعملش مشاكل
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'كتر الطلبات — استنى شوية' },
    });
    app.use(globalLimiter);

    // ===== API Rate Limiting (stricter) =====
    const apiLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'كتر طلبات الـ API — استنى شوية' },
    });

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.locals.basedir = app.get('views');

    // Trust proxy (needed for Railway/load balancers)
    app.set('trust proxy', 1);

    app.use(express.json({ limit: '8mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ===== SEED ENDPOINT (مؤقت) — بعد json() قبل كل API =====
    // يقبل: { key, pairs: [{ botId, channelId }, ...] } أو { key, channels: [...] }
    const pool = require('../src/bot/pool');
    app.post('/api/seed-voice', async (req, res) => {
      try {
        const { key, pairs, channels } = req.body;
        if (key !== 'redbull2026') return res.status(403).json({ error: 'wrong key' });

        // بناء القائمة: botId + channelId
        let assignments = [];
        if (Array.isArray(pairs) && pairs.length) {
          assignments = pairs.map(p => ({ botId: String(p.botId), channelId: String(p.channelId) }));
        } else if (Array.isArray(channels) && channels.length) {
          const bots = storage.getBots();
          for (let i = 0; i < bots.length && i < channels.length; i++) {
            if (channels[i] && channels[i] !== 'skip') {
              assignments.push({ botId: bots[i].id, channelId: String(channels[i]) });
            }
          }
        } else {
          return res.status(400).json({ error: 'محتاج pairs أو channels' });
        }

        const vs = require('../src/bot/features/voiceStay');
        const results = [];

        for (const { botId, channelId } of assignments) {
          const entry = storage.getBot(botId);
          if (!entry) { results.push({ bot: botId, ok: false, error: 'bot not in db' }); continue; }

          const c = pool.get(botId);
          if (!c || !c.isReady()) { results.push({ bot: entry.label, ok: false, error: 'offline' }); continue; }

          // ندور على السيرفر اللي فيه الروم دي
          let guild;
          for (const g of c.guilds.cache.values()) {
            if (g.channels.cache.has(channelId)) { guild = g; break; }
          }
          if (!guild) { results.push({ bot: entry.label, ok: false, error: 'channel not found in any guild' }); continue; }

          // نحفظ الإعدادات
          storage.updateGuild(botId, guild.id, (s) => {
            s.voiceStay.enabled = true;
            s.voiceStay.channelId = channelId;
          });
          storage.setVoiceAssignment(botId, channelId);

          try {
            await vs.joinIfEnabled(c, botId, guild);
            const ch = guild.channels.cache.get(channelId);
            results.push({ bot: entry.label, ok: true, guild: guild.name, channel: ch?.name || channelId });
          } catch (e) {
            results.push({ bot: entry.label, ok: false, error: e.message });
          }
        }

        res.json({ ok: true, results });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });

    const MemoryStore = session.MemoryStore;
    const sessStore = new MemoryStore();
    const sess = session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: sessStore,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: config.baseUrl.startsWith('https'), // Railway uses HTTPS
        sameSite: 'lax',
      },
    });
    app.use(sess);
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // كلمة السر الأول مرة
    storage.initPassword(config.adminPassword);

    app.use(require('./routes/auth'));
    app.use(require('./routes/pages'));
    app.use('/api', apiLimiter, require('./routes/api'));
    app.use('/api', apiLimiter, require('./routes/api-features'));
    app.use('/api/secret', apiLimiter, require('./routes/api-secret'));

    // 404
    app.use((req, res) => {
      if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'مش موجود' });
      res.status(404).send('الصفحة مش موجودة');
    });

    // معالجة أخطاء
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      console.error('[DASHBOARD]', err);
      if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'خطأ في السيرفر' });
      res.status(500).send('حصل خطأ في اللوحة.');
    });

    // HTTP + WebSocket
    if (process.env.VERCEL) {
      return resolve(app);
    }

    const server = http.createServer(app);
    require('./ws-voice').setup(server, sessStore);

    server.listen(config.port, () => {
      console.log(`[DASHBOARD] لوحة التحكم شغالة ✅  ${config.baseUrl}`);
      resolve(app);
    });
  });
};
