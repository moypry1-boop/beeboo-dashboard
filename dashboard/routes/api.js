const express = require('express');
const router = express.Router();
const storage = require('../../src/storage');
const pool = require('../../src/bot/pool');
const { requireAuth, requireMin } = require('../middleware');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

router.use(requireAuth);

function bool(v) { return v === true || v === 'true' || v === 'on'; }
function str(v, max = 2000) { return typeof v === 'string' ? v.slice(0, max) : undefined; }
function int(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
const ACTIONS = ['delete', 'timeout', 'kick', 'ban'];

// البوت المخفي يظهر/يتوصّل ليه المالك بس
function canSeeBot(req, botId) {
  const entry = storage.getBot(botId);
  if (!entry?.hidden) return true;
  return req.session?.authUser?.role === 'owner';
}

function ctxOf(req, res) {
  const { botId, guildId } = req.params;
  const client = pool.get(botId);
  const guild = client?.guilds.cache.get(guildId);
  if (!client || !guild || !canSeeBot(req, botId)) {
    res.status(404).json({ error: 'البوت مش شغال أو مش في السيرفر ده' });
    return null;
  }
  return { client, botId, guild };
}

// ============ إدارة البوتات ============
router.post('/bots/add', async (req, res) => {
  try {
    const hidden = bool(req.body.hidden);
    const script = str(req.body.script, 50) || '';
    // البوت المخفي/السكربت الخاص للمالك بس
    if ((hidden || script) && req.session.authUser.role !== 'owner') {
      return res.status(403).json({ error: 'البوت المخفي والخاص للمالك فقط' });
    }
    const info = await pool.add(req.body.label, req.body.token, hidden, script);
    res.json({ ok: true, bot: info, hidden, script: info.script || '' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/bots/remove', async (req, res) => {
  await pool.remove(String(req.body.id || ''));
  res.json({ ok: true });
});

// ============ شكل البوت: البروفايل + الحالة والنشاط ============
const VALID_STATUS = ['online', 'idle', 'dnd', 'invisible'];
const ACTIVITY_TYPES = ['0', '1', '2', '3', '5'];

router.get('/bot/:botId/profile', requireMin('admin'), (req, res) => {
  const client = pool.get(req.params.botId);
  if (!client?.user || !canSeeBot(req, req.params.botId)) return res.status(404).json({ error: 'البوت مش شغال' });
  const act = client.presence?.activities?.[0];
  res.json({
    ok: true,
    profile: {
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

// تعديل الاسم / الصورة
router.post('/bot/:botId/profile', requireMin('admin'), async (req, res) => {
  const client = pool.get(req.params.botId);
  if (!client?.user || !canSeeBot(req, req.params.botId)) return res.status(404).json({ error: 'البوت مش شغال' });
  const me = req.session.authUser.username;
  try {
    const done = [];

    // اسم المستخدم
    if (req.body.username !== undefined && String(req.body.username).trim() &&
        String(req.body.username).trim() !== client.user.username) {
      const uname = String(req.body.username).trim();
      if (uname.length < 2 || uname.length > 32) return res.status(400).json({ error: 'الاسم لازم بين 2 و 32 حرف' });
      await client.user.setUsername(uname);
      done.push(`الاسم → ${uname}`);
    }

    // الصورة (رابط أو base64 data URL)
    if (req.body.avatarData) {
      const av = String(req.body.avatarData);
      const isUrl = /^https?:\/\/\S+$/.test(av);
      const isData = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(av);
      if (!isUrl && !isData) return res.status(400).json({ error: 'الصورة لازم رابط أو ملف صورة صالح' });
      if (isData && av.length > 8 * 1024 * 1024) return res.status(400).json({ error: 'الصورة كبيرة أوي — جرب صورة أصغر' });
      await client.user.setAvatar(isUrl ? av : Buffer.from(av.split(',')[1], 'base64'));
      done.push('الصورة اتغيرت');
    }

    if (!done.length) return res.status(400).json({ error: 'مفيش حاجة تتغير' });
    storage.pushAudit(me, '🎭 تعديل بروفايل بوت', `${client.user.tag} — ${done.join(' · ')}`);
    res.json({ ok: true, changed: done, tag: client.user.tag, avatar: client.user.displayAvatarURL({ size: 256 }) });
  } catch (e) {
    const msg = /rate/i.test(e.message) ? 'ديسكورد بيحدد التعديل بمرة كل فترة — استنى شوية وجرب تاني' : e.message;
    res.status(500).json({ error: msg });
  }
});

// الحالة والنشاط
router.post('/bot/:botId/presence', requireMin('admin'), async (req, res) => {
  const client = pool.get(req.params.botId);
  if (!client?.user || !canSeeBot(req, req.params.botId)) return res.status(404).json({ error: 'البوت مش شغال' });
  const b = req.body;
  const status = VALID_STATUS.includes(b.status) ? b.status : 'online';

  let activities = [];
  const type = String(b.activityType ?? 'none');
  const name = String(b.activityName || '').slice(0, 128).trim();

  if (type === '4') { // ستاتس مخصص
    if (name) activities = [{ type: 4, name: 'Custom Status', state: name }];
  } else if (ACTIVITY_TYPES.includes(type) && name) {
    const act = { name, type: Number(type), url: undefined };
    if (type === '1') { // بث يتطلب لينك
      if (!/^https?:\/\/(www\.)?(twitch\.tv|youtube\.com)\//.test(String(b.streamUrl || ''))) {
        return res.status(400).json({ error: 'البث محتاج لينك Twitch أو YouTube صالح' });
      }
      act.url = String(b.streamUrl);
    }
    activities = [act];
  }

  try {
    client.user.setPresence({ status, activities, afk: false });
    storage.pushAudit(req.session.authUser.username, '✨ تغيير حالة بوت', `${client.user.tag} → ${status}${name ? ` (${name})` : ''}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// تغيير كلمة سر اللوحة (اتنقل لـ api-features — نسيب هنا للتوافق)
router.post('/panel/password', (req, res) => {
  const { current, next1, next2 } = req.body;
  if (!storage.checkPassword(current || '')) return res.status(400).json({ error: 'كلمة السر الحالية غلط' });
  if (!next1 || String(next1).length < 3) return res.status(400).json({ error: 'كلمة السر الجديدة لازم 3 حروف على الأقل' });
  if (next1 !== next2) return res.status(400).json({ error: 'كلمتين السر الجداد مش زي بعض' });
  storage.setPassword(next1);
  // لو في ADMIN_PASSWORD متغير بيئة، نحدّثه عشان يفضل يشتغل بعد أي restart
  if (process.env.ADMIN_PASSWORD !== undefined) {
    process.env.ADMIN_PASSWORD = next1;
    storage.initPassword(next1); // يتأكد إنه محفوظ في الـ db
  }
  res.json({ ok: true });
});

// ============ إعدادات السيرفر ============
router.post('/server/:botId/:guildId/:section', async (req, res, next) => {
  const c = ctxOf(req, res);
  if (!c) return;
  const { section } = req.params;

  try {
    switch (section) {
      case 'general': {
        const prefix = str(req.body.prefix, 8);
        if (!prefix || prefix.length > 6) return res.status(400).json({ error: 'البريفيكس لازم يكون من 1 لـ 6 حروف' });
        storage.updateGuild(c.botId, c.guild.id, (s) => { s.prefix = prefix; });
        break;
      }
      case 'whitelist': {
        const rx = /^(\d{5,25})$/;
        const chans = String(req.body.whitelistChannels || '').split(/[\s,]+/).filter((x) => rx.test(x));
        const rl = String(req.body.whitelistRoles || '').split(/[\s,]+/).filter((x) => rx.test(x));
        storage.updateGuild(c.botId, c.guild.id, (s) => { s.whitelistChannels = chans; s.whitelistRoles = rl; });
        break;
      }
      case 'protection': {
        const feature = req.body.feature;
        const p = storage.getGuild(c.botId, c.guild.id).protection[feature];
        if (!p) return res.status(400).json({ error: 'ميزة حماية غير معروفة' });
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          const t = s.protection[feature];
          if ('enabled' in req.body) t.enabled = bool(req.body.enabled);
          if ('action' in req.body && ACTIONS.includes(req.body.action)) t.action = req.body.action;
          if ('words' in req.body) t.words = String(req.body.words || '').split(/[\n,]/).map((w) => w.trim()).filter(Boolean).slice(0, 100);
          if ('maxMessages' in req.body) t.maxMessages = int(req.body.maxMessages, 2, 30, 6);
          if ('perSeconds' in req.body) t.perSeconds = int(req.body.perSeconds, 1, 120, 5);
          if ('maxMentions' in req.body) t.maxMentions = int(req.body.maxMentions, 1, 50, 6);
          if ('maxJoins' in req.body) t.maxJoins = int(req.body.maxJoins, 2, 100, 6);
          if ('perMinutes' in req.body) t.perMinutes = int(req.body.perMinutes, 1, 60, 1);
        });
        break;
      }
      case 'welcome':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.welcome.enabled = bool(req.body.enabled);
          s.welcome.channelId = str(req.body.channelId, 25) || '';
          s.welcome.message = str(req.body.message, 1500) || s.welcome.message;
          s.welcome.embed = bool(req.body.embed);
          s.welcome.dmEnabled = bool(req.body.dmEnabled);
          s.welcome.dmMessage = str(req.body.dmMessage, 1000) || '';
        });
        break;
      case 'leave':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.leave.enabled = bool(req.body.enabled);
          s.leave.channelId = str(req.body.channelId, 25) || '';
          s.leave.message = str(req.body.message, 1500) || s.leave.message;
        });
        break;
      case 'autorole':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.autoRole.enabled = bool(req.body.enabled);
          s.autoRole.roleId = str(req.body.roleId, 25) || '';
        });
        break;
      case 'logs':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.logs.enabled = bool(req.body.enabled);
          s.logs.channelId = str(req.body.channelId, 25) || '';
          if (req.body.events && typeof req.body.events === 'object') {
            for (const [k, v] of Object.entries(req.body.events)) {
              if (k in s.logs.events) s.logs.events[k] = bool(v);
            }
          }
        });
        break;
      case 'moderation':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.moderation.modLogChannelId = str(req.body.modLogChannelId, 25) || '';
        });
        break;
      case 'tickets':
        storage.updateGuild(c.botId, c.guild.id, (s) => {
          s.tickets.enabled = bool(req.body.enabled);
          s.tickets.categoryId = str(req.body.categoryId, 25) || '';
          s.tickets.supportRoleId = str(req.body.supportRoleId, 25) || '';
          s.tickets.panelChannelId = str(req.body.panelChannelId, 25) || '';
          s.tickets.welcomeMessage = str(req.body.welcomeMessage, 1000) || s.tickets.welcomeMessage;
        });
        break;
      case 'voicestay':
        // القعود الصوتي له روت مخصص في api-features (بيحكم دخول/خروج فعلي)
        return next();
      case 'ai':
        // الرد التلقائي (AI) له روت مخصص في api-features
        return next();
      case 'streaks':
        // نظام الستريك للبنات — روت مخصص في api-features
        return next();
      default:
        return res.status(404).json({ error: 'قسم غير معروف' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[API]', e);
    res.status(500).json({ error: e.message });
  }
});

// ============ الأوامر المخصصة ============
router.post('/server/:botId/:guildId/customcommands/add', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const name = String(req.body.name || '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 20);
  const response = str(req.body.response, 1500);
  if (!name || !response) return res.status(400).json({ error: 'الاسم والرد مطلوبين' });
  let err = null;
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    if (s.customCommands.length >= 50) { err = 'الحد الأقصى 50 أمر'; return; }
    if (s.customCommands.some((x) => x.name === name)) { err = 'فيه أمر بنفس الاسم'; return; }
    s.customCommands.push({ name, response, enabled: true });
  });
  if (err) return res.status(400).json({ error: err });
  res.json({ ok: true });
});

router.post('/server/:botId/:guildId/customcommands/toggle', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const name = str(req.body.name, 20);
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    const cmd = s.customCommands.find((x) => x.name === name);
    if (cmd) cmd.enabled = cmd.enabled === false;
  });
  res.json({ ok: true });
});

router.post('/server/:botId/:guildId/customcommands/delete', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const name = str(req.body.name, 20);
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.customCommands = s.customCommands.filter((x) => x.name !== name);
  });
  res.json({ ok: true });
});

// ============ أوامر مباشرة (إشراف لايف من اللوحة) ============
router.post('/server/:botId/:guildId/action', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const { client, guild } = c;
  const type = String(req.body.type || '');
  const userId = String(req.body.userId || '').trim();
  const reason = str(req.body.reason, 300) || 'من لوحة التحكم';
  if (!/^\d{5,25}$/.test(userId)) return res.status(400).json({ error: 'آي دي غير صالح' });

  const modLogEmbed = (title) => {
    const chId = storage.getGuild(c.botId, guild.id).moderation.modLogChannelId;
    const ch = chId && guild.channels.cache.get(chId);
    if (ch?.isTextBased()) ch.send({
      embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle(title)
        .addFields(
          { name: 'الهدف', value: `<@${userId}> (\`${userId}\`)`, inline: true },
          { name: 'بواسطة', value: 'لوحة التحكم 👑', inline: true },
          { name: 'السبب', value: reason },
        ).setTimestamp()],
    }).catch(() => {});
  };

  try {
    switch (type) {
      case 'ban':
        await userSend(client, userId, `تم حظرك من **${guild.name}** | السبب: ${reason}`);
        await guild.members.ban(userId, { reason: `لوحة التحكم: ${reason}` });
        modLogEmbed('🔨 حظر من اللوحة');
        break;
      case 'unban':
        await guild.members.unban(userId);
        break;
      case 'kick': {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).json({ error: 'العضو مش في السيرفر' });
        if (!member.kickable) return res.status(403).json({ error: 'رتبته أعلى من رتبة البوت' });
        await userSend(client, userId, `تم طردك من **${guild.name}** | السبب: ${reason}`);
        await member.kick(`لوحة التحكم: ${reason}`);
        modLogEmbed('👢 طرد من اللوحة');
        break;
      }
      case 'timeout': {
        const minutes = int(req.body.minutes, 1, 40320, 10);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).json({ error: 'العضو مش في السيرفر' });
        if (!member.moderatable) return res.status(403).json({ error: 'البوت مقدرش يسكاته' });
        await member.timeout(minutes * 60 * 1000, `لوحة التحكم: ${reason}`);
        modLogEmbed(`🔇 إسكات (${minutes} دقيقة) من اللوحة`);
        break;
      }
      case 'untimeout': {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).json({ error: 'العضو مش في السيرفر' });
        await member.timeout(null);
        break;
      }
      case 'warn':
        storage.updateGuild(c.botId, guild.id, (s) => {
          s.warnings[userId] = s.warnings[userId] || [];
          s.warnings[userId].push({ reason, by: 'لوحة التحكم', at: Date.now() });
        });
        await userSend(client, userId, `⚠️ اتخذت تحذير في **${guild.name}** | السبب: ${reason}`);
        modLogEmbed('⚠️ تحذير من اللوحة');
        break;
      default:
        return res.status(400).json({ error: 'نوع أمر غير معروف' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[ACTION]', e);
    res.status(500).json({ error: e.rawError?.message || e.message || 'فشل تنفيذ الأمر — اتأكد من صلاحيات البوت ورتبته.' });
  }
});

async function userSend(client, userId, content) {
  try {
    const u = await client.users.fetch(userId);
    await u.send(content);
  } catch { /* مقفول DM */ }
}

router.post('/server/:botId/:guildId/warnings/clear', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const userId = str(req.body.userId, 25);
  storage.updateGuild(c.botId, c.guild.id, (s) => { delete s.warnings[userId]; });
  res.json({ ok: true });
});

// ============ رسائل خاصة (DM) ============
router.get('/dm/guilds', (req, res) => {
  const botId = str(req.query.botId, 25);
  const client = pool.get(botId);
  if (!client || !client.isReady() || !canSeeBot(req, botId)) return res.status(404).json({ error: 'البوت مش شغال' });
  const guilds = client.guilds.cache.map((g) => ({ id: g.id, name: g.name }))
    .sort((a, b) => a.name.localeCompare(b.name)).slice(0, 200);
  res.json({ ok: true, guilds });
});

router.get('/dm/members', (req, res) => {
  const botId = str(req.query.botId, 25);
  const guildId = str(req.query.guildId, 25);
  const q = String(req.query.q || '').slice(0, 60).toLowerCase();
  const client = pool.get(botId);
  const guild = client?.guilds.cache.get(guildId);
  if (!client || !guild || !canSeeBot(req, botId)) return res.status(404).json({ error: 'البوت أو السيرفر مش موجود' });
  if (q.length < 2) return res.json({ ok: true, members: [] });

  const members = [...guild.members.cache.values()]
    .filter((m) => !m.user.bot && (m.user.globalName || m.user.username).toLowerCase().includes(q))
    .sort((a, b) => (a.user.globalName || a.user.username).localeCompare(b.user.globalName || b.user.username))
    .slice(0, 25)
    .map((m) => ({ id: m.id, name: (m.user.globalName || m.user.username) + (m.nickname ? ` (${m.nickname})` : ''), avatar: m.user.displayAvatarURL({ size: 64 }) }));
  res.json({ ok: true, members });
});

router.post('/dm/send', async (req, res) => {
  try {
    const botId = str(req.body.botId, 25);
    const userId = str(req.body.userId, 25);
    const content = str(req.body.content, 3500) || str(req.body.message, 3500);
    const client = pool.get(botId);
    if (!client || !client.isReady() || !canSeeBot(req, botId)) return res.status(404).json({ error: 'البوت مش شغال' });
    if (!userId) return res.status(400).json({ error: 'حط ID العضو' });
    if (!content) return res.status(400).json({ error: 'الرسالة فاضية' });

    // نجرّب نفتح DM مع العضو — لازم يكون في سيرفر مشترك مع البوت عادةً
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return res.status(404).json({ error: 'معرفتش أجيب بيانات العضو' });

    await user.send({ content });
    storage.pushAudit(req.session?.authUser?.username, '📨 رسالة خاصة', `إلى ${user.username} (${userId}) من بوت ${botId}: ${content.slice(0, 50)}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: 'فشل الإرسال: ' + (e.message || e) });
  }
});

// إرسال لكل أعضاء سيرفر (DM جماعي)
router.post('/dm/all', async (req, res) => {
  try {
    const botId = str(req.body.botId, 25);
    const guildId = str(req.body.guildId, 25);
    const content = str(req.body.content, 3500) || str(req.body.message, 3500);
    const client = pool.get(botId);
    const guild = client?.guilds.cache.get(guildId);
    if (!client || !client.isReady() || !canSeeBot(req, botId)) return res.status(404).json({ error: 'البوت مش شغال' });
    if (!guild) return res.status(404).json({ error: 'السيرفر مش موجود' });
    if (!content) return res.status(400).json({ error: 'الرسالة فاضية' });

    // أجيب كل الأعضاء (غير البوتات)
    const members = [...guild.members.cache.values()].filter((m) => !m.user.bot);

    let sent = 0, failed = 0;
    // نرسل بالتسلسل عشان مفيش Rate Limit — حاول لكل واحد
    for (const m of members) {
      try {
        await m.send({ content });
        sent++;
      } catch { failed++; }
      // وقفة خفيفة عشان منضربش Rate Limit
      if (sent + failed >= 5) await new Promise((r) => setTimeout(r, 900));
    }

    storage.pushAudit(req.session?.authUser?.username, '📬 رسالة جماعية', `إلى ${sent} عضو في ${guild.name} (من بوت ${botId}): ${content.slice(0, 50)}`);
    res.json({ ok: true, sent, failed, total: members.length });
  } catch (e) {
    res.status(400).json({ error: 'فشل الإرسال: ' + (e.message || e) });
  }
});

// نشر لوحة التذاكر
router.post('/server/:botId/:guildId/tickets/post-panel', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  const ch = c.guild.channels.cache.get(s.tickets.panelChannelId);
  if (!ch?.isTextBased()) return res.status(400).json({ error: 'اختار قناة لوحة التذاكر الصحيحة الأول واحفظ الإعدادات' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open').setLabel('فتح تذكرة').setEmoji('🎫').setStyle(ButtonStyle.Primary),
  );
  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle('🎫 نظام التذاكر')
    .setDescription(s.tickets.welcomeMessage || 'اضغط الزر تحت عشان تفتح تذكرة خاصة.')
    .setFooter({ text: c.guild.name, iconURL: c.guild.iconURL() ?? undefined });
  await ch.send({ embeds: [embed], components: [row] }).catch((e) => {
    return res.status(500).json({ error: 'معرفتش أبعت الرسالة: ' + e.message });
  });
  res.json({ ok: true });
});

module.exports = router;
