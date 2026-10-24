const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware');
const pool = require('../../src/bot/pool');

router.get('/login', (req, res) => {
  if (req.session?.authUser) return res.redirect('/');
  res.render('login', { err: req.query.err || null });
});

router.get('/secret', requireAuth, (req, res) => {
  if (!req.session.secretUnlocked) return res.redirect('/');
  res.render('secret');
});

router.get('/', requireAuth, (req, res) => {
  const storageM = require('../../src/storage');
  const isOwner = req.session.authUser.role === 'owner';
  const visible = (id) => {
    const e = storageM.getBot(id);
    return !e?.hidden || isOwner;
  };

  const bots = pool ? [...pool.clients.keys()].filter(visible).map((id) => {
    const meta = pool.meta.get(id) || {};
    return {
      id,
      label: (storageM.getBot(id) || {}).label || meta.username,
      username: meta.username,
      tag: meta.tag,
      avatar: meta.avatar,
      guildsCount: pool.get(id)?.guilds.cache.size ?? 0,
      online: true,
    };
  }) : [];

  // بوتات متسجلة بس مش شغالة (توكن غلط مثلاً)
  for (const b of storageM.getBots()) {
    if (!visible(b.id)) continue;
    if (!pool.clients.has(b.id)) {
      bots.push({ id: b.id, label: b.label, username: b.label, tag: b.label, avatar: null, guildsCount: 0, online: false, error: pool.errorOf(b.id) });
    }
  }

  res.render('index', { bots, totalLimit: 100, isOwner });
});

// ===== سيرفرات بوت معين =====
router.get('/bot/:botId', requireAuth, (req, res, next) => {
  const stLocal = require('../../src/storage');
  const entry = stLocal.getBot(req.params.botId);
  if (entry?.hidden && req.session.authUser.role !== 'owner') return res.redirect('/');
  const client = pool.get(req.params.botId);
  if (!client) return res.redirect('/');
  const botInfo = pool.meta.get(req.params.botId) || {};
  const storage = require('../../src/storage');
  const label = (storage.getBot(req.params.botId) || {}).label || botInfo.username;

  const guilds = client.guilds.cache.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.iconURL({ size: 128 }),
    memberCount: g.memberCount,
  })).sort((a, b) => a.name.localeCompare(b.name));

  res.render('guilds', {
    user: null,
    bot: { id: req.params.botId, label, tag: botInfo.tag, avatar: botInfo.avatar },
    guilds,
    clientIdForInvite: req.params.botId,
  });
});

// ===== صفحة إرسال رسائل خاصة (DM) — أبسط شكل، بلا JS =====
function dmRender(req, res, msg) {
  const st = require('../../src/storage');
  const isOwner = req.session.authUser.role === 'owner';
  const bots = [...(pool.clients?.keys() || [])]
    .filter((id) => { const e = st.getBot(id); return !e?.hidden || isOwner; })
    .map((id) => {
    const meta = pool.meta.get(id) || {};
    return {
      id,
      label: (st.getBot(id) || {}).label || meta.username || meta.tag || id,
      tag: meta.tag,
    };
  }).sort((a, b) => a.label.localeCompare(b.label));

  // أول بوت متاح = افتراضي لو مفيش اختيار
  const botId = req.query.botId && pool.get(req.query.botId) ? req.query.botId : (bots[0]?.id || '');
  const client = pool.get(botId);
  const guilds = client
    ? client.guilds.cache.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g.memberCount,
      })).sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const guildId = req.query.guildId && guilds.some((g) => String(g.id) === String(req.query.guildId))
    ? req.query.guildId
    : (guilds[0]?.id || '');
  const content = (req.method === 'POST' && req.body?.content) ? req.body.content : (req.query.text || '');

  res.render('dm', { user: null, bots, botId, guilds, guildId, content, msg: msg || null });
}

router.get('/dm', requireAuth, (req, res) => dmRender(req, res, null));

router.post('/dm/send', requireAuth, async (req, res) => {
  const { botId, guildId, content } = req.body || {};
  const client = pool.get(botId);
  const guild = client?.guilds.cache.get(guildId);
  const text = String(content || '').trim();
  try {
    if (!client || !guild) throw new Error('البوت أو السيرفر مش موجود');
    if (!text) throw new Error('اكتب الرسالة الأول');

    let members;
    try {
      members = await guild.members.fetch();
    } catch { members = guild.members.cache; }

    const targets = [...members.values()].filter((m) => !m.user.bot);
    let sent = 0, failed = 0;
    const chunk = 5, pause = 400;
    for (let i = 0; i < targets.length; i += chunk) {
      await Promise.all(targets.slice(i, i + chunk).map(async (m) => {
        try { await m.send(text); sent += 1; }
        catch { failed += 1; }
      }));
      if (i + chunk < targets.length) await new Promise((r) => setTimeout(r, pause));
    }

    dmRender(req, res, { ok: true, text: `✅ اتوزعت الرسالة على ${sent} عضو` + (failed ? ` (تعذر على ${failed})` : '') });
  } catch (e) {
    dmRender(req, res, { ok: false, text: '❌ ' + (e.message || e) });
  }
});

// ===== لوحة سيرفر (نفس التابات) =====
router.get('/server/:botId/:guildId', requireAuth, (req, res, next) => {
  const entryLocal = require('../../src/storage').getBot(req.params.botId);
  if (entryLocal?.hidden && req.session.authUser.role !== 'owner') return res.redirect('/');
  const client = pool.get(req.params.botId);
  const guild = client?.guilds.cache.get(req.params.guildId);
  if (!client || !guild) return res.redirect('/');

  const storage = require('../../src/storage');
  const settings = storage.getGuild(req.params.botId, guild.id);

  const textChannels = guild.channels.cache
    .filter((c) => c.type === 0)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));
  const voiceChannels = guild.channels.cache
    .filter((c) => c.type === 2)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));
  const categories = guild.channels.cache
    .filter((c) => c.type === 4)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name }));
  const roles = guild.roles.cache
    .filter((r) => !r.managed && r.id !== guild.id && r.editable)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));

  const warningsList = [];
  for (const [userId, list] of Object.entries(settings.warnings || {})) {
    for (const w of list) warningsList.push({ userId, ...w });
  }
  warningsList.sort((a, b) => b.at - a.at);

  // البوتات الموجودة في نفس السيرفر (للاختيار: مين يبعت رسالة الستريك)
  const stEntry = require('../../src/storage');
  const isOwner = req.session.authUser.role === 'owner';
  const botsInGuild = [...(pool.clients?.keys() || [])].map((bid) => {
    if (stEntry.getBot(bid)?.hidden && !isOwner) return null;
    const cl = pool.get(bid);
    if (!cl) return null;
    const g = cl.guilds.cache.get(guild.id);
    if (!g) return null;
    return { id: bid, tag: cl.user?.tag || bid };
  }).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));

  res.render('server', {
    user: null,
    clientId: client.user.id,
    botTag: client.user.tag,
    botId: req.params.botId,
    botsInGuild,
    config: require('../../src/config'),
    guild: {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ size: 128 }),
      memberCount: guild.memberCount,
      textChannelsCount: guild.channels.cache.filter((c) => c.type === 0).size,
      voiceChannelsCount: guild.channels.cache.filter((c) => c.type === 2).size,
      rolesCount: guild.roles.cache.size,
      boostLevel: guild.premiumTier,
      ownerId: guild.ownerId,
    },
    settings,
    textChannels,
    voiceChannels,
    categories,
    roles,
    warningsList,
  });
});

// ===== صفحات إضافية للسيرفر =====
function serverCtx(req, res) {
  const entryL = require('../../src/storage').getBot(req.params.botId);
  if (entryL?.hidden && req.session.authUser.role !== 'owner') { res.redirect('/'); return null; }
  const client = pool.get(req.params.botId);
  const guild = client?.guilds.cache.get(req.params.guildId);
  if (!client || !guild) { res.redirect('/'); return null; }
  const storage = require('../../src/storage');
  return { client, guild, storage, botId: req.params.botId };
}

function renderServerSub(req, res, view) {
  const c = serverCtx(req, res); if (!c) return;
  const settings = c.storage.getGuild(c.botId, c.guild.id);
  const textChannels = c.guild.channels.cache.filter((ch) => ch.type === 0)
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((ch) => ({ id: ch.id, name: ch.name }));
  const roles = c.guild.roles.cache
    .filter((r) => !r.managed && r.id !== c.guild.id && r.editable)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));
  res.render(view, {
    user: null,
    clientId: c.client.user.id,
    botTag: c.client.user.tag,
    botId: c.botId,
    guild: {
      id: c.guild.id, name: c.guild.name, icon: c.guild.iconURL({ size: 128 }),
      memberCount: c.guild.memberCount,
      textChannelsCount: c.guild.channels.cache.filter((x) => x.type === 0).size,
      voiceChannelsCount: c.guild.channels.cache.filter((x) => x.type === 2).size,
      rolesCount: c.guild.roles.cache.size, boostLevel: c.guild.premiumTier, ownerId: c.guild.ownerId,
    },
    settings, textChannels, roles,
  });
}

router.get('/server/:botId/:guildId/members', requireAuth, (req, res) => renderServerSub(req, res, 'members'));
router.get('/server/:botId/:guildId/roles', requireAuth, (req, res) => renderServerSub(req, res, 'roles'));
router.get('/server/:botId/:guildId/builder', requireAuth, (req, res) => renderServerSub(req, res, 'builder'));
router.get('/server/:botId/:guildId/giveaways', requireAuth, (req, res) => {
  renderServerSub(req, res, 'giveaways');
});

// ===== شكل البوت (البروفايل) =====
router.get('/bot/:botId/profile', requireAuth, require('../middleware').requireMin('admin'), (req, res, next) => {
  const entryP = require('../../src/storage').getBot(req.params.botId);
  if (entryP?.hidden && req.session.authUser.role !== 'owner') return res.redirect('/');
  const client = pool.get(req.params.botId);
  if (!client?.user) return res.redirect('/');
  const storage = require('../../src/storage');
  const meta = pool.meta.get(req.params.botId) || {};
  const act = client.presence?.activities?.[0];

  res.render('profile', {
    user: null,
    botId: req.params.botId,
    label: (storage.getBot(req.params.botId) || {}).label || meta.username || 'البوت',
    prof: {
      id: client.user.id,
      username: client.user.username,
      tag: client.user.tag,
      avatar: client.user.displayAvatarURL({ size: 256 }),
      status: client.presence?.status || 'online',
      actType: act ? String(act.type) : 'none',
      actName: act ? (String(act.type) === '4' ? (act.state || '') : (act.name || '')) : '',
    },
  });
});

// ===== حسابات اللوحة + سجل العمليات =====
router.get('/panel/users', requireAuth, require('../middleware').requireMin('owner'), (req, res) => {
  res.render('users', { user: null });
});
router.get('/panel/auditlog', requireAuth, require('../middleware').requireMin('admin'), (req, res) => {
  res.render('auditlog', { user: null, log: require('../../src/storage').getAudit(300) });
});

module.exports = router;
