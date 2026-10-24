// APIs الميزات الجديدة: أعضاء، رتب، embed builder، سحبات، XP، لوكداون...
const express = require('express');
const router = express.Router();
const storage = require('../../src/storage');
const pool = require('../../src/bot/pool');
const config = require('../../src/config');
const { requireAuth, requireMin } = require('../middleware');

router.use(requireAuth);

// البوت المخفي للمالك بس
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

function audit(req, action, details) {
  storage.pushAudit(req.session.authUser.username, action, details);
}

// ================= الأعضاء لايف =================
router.get('/server/:botId/:guildId/members', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    // جلب كامل من الجيتوي مرة واحدة بس — بعد كده الكاش المحلي يكفي
    // (منع سبام opcode 8 اللي بيخلي ديسكورد يعمل rate limit)
    const needFetch = c.guild.members.cache.size < Math.max(50, c.guild.memberCount - 5);
    if (needFetch) {
      await c.guild.members.fetch().catch((e) => {
        const m = String(e.message || '');
        if (/rate/i.test(m)) throw new Error('ديسكورد بيعمل تهدئة مؤقتة — جرب بعد 10 ثواني وهتشتغل عادي');
        throw e;
      });
    }
    const q = String(req.query.search || '').toLowerCase().trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const perPage = 50;

    let list = [...c.guild.members.cache.values()];
    if (q) {
      list = list.filter((m) =>
        m.user.username.toLowerCase().includes(q) ||
        (m.nickname || '').toLowerCase().includes(q) ||
        m.user.id.includes(q)
      );
    }
    list.sort((a, b) => (b.joinedTimestamp || 0) - (a.joinedTimestamp || 0));

    const total = list.length;
    const items = list.slice((page - 1) * perPage, page * perPage).map((m) => ({
      id: m.id,
      tag: m.user.tag,
      username: m.user.username,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      nickname: m.nickname,
      bot: m.user.bot,
      roles: m.roles.cache.filter((r) => r.id !== c.guild.id).map((r) => ({ id: r.id, name: r.name, color: r.hexColor })),
      joinedAt: m.joinedTimestamp,
    }));
    res.json({ ok: true, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// إضافة/شيل رتبة من عضو
router.post('/server/:botId/:guildId/member/role', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const { memberId, roleId } = req.body;
  const mode = req.body.mode === 'remove' ? 'remove' : 'add';
  try {
    const member = await c.guild.members.fetch(String(memberId)).catch(() => null);
    const role = c.guild.roles.cache.get(String(roleId));
    if (!member || !role) return res.status(404).json({ error: 'العضو أو الرتبة غير موجودة' });
    await member.roles[mode](role, `من لوحة التحكم بواسطة ${req.session.authUser.username}`);
    audit(req, mode === 'add' ? 'إعطاء رتبة' : 'سحب رتبة', `${member.user.tag} ← ${role.name} في ${c.guild.name}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.rawError?.message || e.message });
  }
});

// ================= الرتب =================
router.get('/server/:botId/:guildId/roles/list', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const roles = c.guild.roles.cache
    .sort((a, b) => b.position - a.position)
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.hexColor,
      membersCount: r.members.size,
      managed: r.managed,
      editable: r.editable && r.id !== c.guild.id,
      position: r.position,
    }));
  res.json({ ok: true, myPosition: c.guild.members.me.roles.highest.position, roles });
});

router.post('/server/:botId/:guildId/roles/create', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: 'اكتب اسم الرتبة' });
    const color = /^#[0-9a-f]{6}$/i.test(req.body.color || '') ? req.body.color : '#99aab5';
    const role = await c.guild.roles.create({
      name,
      color,
      permissions: parsePerms(req.body.perms),
      reason: `لوحة التحكم (${req.session.authUser.username})`,
    });
    audit(req, 'إنشاء رتبة', `${role.name} في ${c.guild.name}`);
    res.json({ ok: true, id: role.id });
  } catch (e) { res.status(500).json({ error: e.rawError?.message || e.message }); }
});

router.post('/server/:botId/:guildId/roles/update', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const role = c.guild.roles.cache.get(String(req.body.roleId));
    if (!role || !role.editable) return res.status(404).json({ error: 'الرتبة مش موجودة أو أعلى من رتبتي' });
    const patch = {};
    if (req.body.name) patch.name = String(req.body.name).trim().slice(0, 100);
    if (/^#[0-9a-f]{6}$/i.test(req.body.color || '')) patch.color = req.body.color;
    if (req.body.perms) patch.permissions = parsePerms(req.body.perms);
    await role.edit(patch, `لوحة التحكم (${req.session.authUser.username})`);
    audit(req, 'تعديل رتبة', `${role.name} في ${c.guild.name}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.rawError?.message || e.message }); }
});

router.post('/server/:botId/:guildId/roles/delete', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const role = c.guild.roles.cache.get(String(req.body.roleId));
    if (!role || !role.editable) return res.status(404).json({ error: 'الرتبة مش موجودة أو أعلى من رتبتي' });
    const name = role.name;
    await role.delete(`لوحة التحكم (${req.session.authUser.username})`);
    audit(req, 'حذف رتبة', `${name} في ${c.guild.name}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.rawError?.message || e.message }); }
});

const COMMON_PERMS = {
  Administrator: 'Administrator',
  ManageGuild: 'ManageGuild',
  ManageRoles: 'ManageRoles',
  ManageChannels: 'ManageChannels',
  KickMembers: 'KickMembers',
  BanMembers: 'BanMembers',
  ModerateMembers: 'ModerateMembers',
  ManageMessages: 'ManageMessages',
  ViewChannel: 'ViewChannel',
  SendMessages: 'SendMessages',
};
function parsePerms(perms) {
  if (!Array.isArray(perms)) return [];
  if (perms.includes('Administrator')) return ['Administrator'];
  return perms.filter((p) => COMMON_PERMS[p]);
}
router.COMMON_PERMS = COMMON_PERMS;

// ================= Embed Builder =================
router.post('/server/:botId/:guildId/embed/send', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const b = req.body;
    const ch = c.guild.channels.cache.get(String(b.channelId || ''));
    if (!ch?.isTextBased()) return res.status(400).json({ error: 'اختار روم صالح' });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    if (EmbedBuilder === undefined) throw new Error('x');
    const embed = new EmbedBuilder();
    if (b.title) embed.setTitle(String(b.title).slice(0, 256));
    else if (!b.description) return res.status(400).json({ error: 'اكتب عنوان أو وصف على الأقل' });
    if (b.description) embed.setDescription(String(b.description).slice(0, 4000));
    if (/^#[0-9a-f]{6}$/i.test(b.color || '')) embed.setColor(parseInt(b.color.slice(1), 16));
    if (b.authorName) embed.setAuthor({ name: String(b.authorName).slice(0, 256), iconURL: b.authorIcon || undefined });
    if (b.footerText) embed.setFooter({ text: String(b.footerText).slice(0, 2048), iconURL: b.footerIcon || undefined });
    if (/^https?:\/\//.test(b.image || '')) embed.setImage(b.image);
    if (/^https?:\/\//.test(b.thumbnail || '')) embed.setThumbnail(b.thumbnail);
    if (b.timestamp) embed.setTimestamp();
    if (b.url && /^https?:\/\//.test(b.url) && b.title) embed.setURL(b.url);

    // أزرار روابط (لحد 3)
    const links = [b.btn1Label, b.btn2Label, b.btn3Label]
      .map((l, i) => ({ label: (l || '').trim(), url: [b.btn1Url, b.btn2Url, b.btn3Url][i] }))
      .filter((x) => x.label && /^https?:\/\//.test(x.url || '')).slice(0, 3);

    let components;
    if (links.length) {
      components = [new ActionRowBuilder().addComponents(
        ...links.map((l) => new ButtonBuilder().setLabel(l.label).setStyle(ButtonStyle.Link).setURL(l.url))
      )];
    }

    await ch.send({ content: b.content ? String(b.content).slice(0, 2000) : undefined, embeds: [embed], components });
    audit(req, 'إرسال رسالة embed', `في #${ch.name} — ${c.guild.name}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.rawError?.message || e.message }); }
});

// ================= السحبات =================
router.post('/server/:botId/:guildId/giveaways/create', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const prize = String(req.body.prize || '').trim().slice(0, 200);
    const durationMinutes = Math.max(1, Math.min(parseInt(req.body.durationMinutes, 10) || 10, 43200));
    const winnerCount = Math.max(1, Math.min(parseInt(req.body.winnerCount, 10) || 1, 10));
    const channelId = String(req.body.channelId || '');
    if (!prize) return res.status(400).json({ error: 'اكتب اسم الجايزة' });

    const gw = await require('../../src/bot/features/giveaways').createGiveaway(c.client, c.botId, c.guild, {
      prize, durationMinutes, winnerCount, channelId, hostedBy: c.client.user.id,
    });
    audit(req, 'إنشاء سحبة', `${prize} في ${c.guild.name}`);
    res.json({ ok: true, giveaway: gw });
  } catch (e) { res.status(500).json({ error: e.rawError?.message || e.message }); }
});

router.post('/server/:botId/:guildId/giveaways/delete', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const id = String(req.body.id || '');
  storage.updateGuild(c.botId, c.guild.id, (s) => { s.giveaways = (s.giveaways || []).filter((g) => g.id !== id); });
  res.json({ ok: true });
});

router.post('/server/:botId/:guildId/giveaways/reroll', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const id = String(req.body.id || '');
    const s = storage.getGuild(c.botId, c.guild.id);
    const gw = (s.giveaways || []).find((g) => g.id === id && g.ended);
    if (!gw) return res.status(404).json({ error: 'السحبة مش موجودة أو لسه شغالة' });

    const channel = c.guild.channels.cache.get(gw.channelId);
    const msg = channel ? await channel.messages.fetch(gw.messageId).catch(() => null) : null;
    const reaction = msg?.reactions.cache.get('🎉');
    const users = reaction ? await reaction.users.fetch() : null;
    const entries = users ? [...users.values()].filter((u) => !u.bot) : [];
    if (!entries.length) return res.json({ ok: true, winner: null });
    const winner = entries[Math.floor(Math.random() * entries.length)];
    if (channel) await channel.send(`🔁 **إعادة سحب!** الفايز الجديد في **${gw.prize}**: <@${winner.id}> 🎉`).catch(() => {});
    res.json({ ok: true, winner: winner.tag });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= Anti-Nuke =================
router.post('/server/:botId/:guildId/antinuke', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.antiNuke.enabled = !!b.enabled;
    if (['removeroles', 'kick', 'ban'].includes(b.punish)) s.antiNuke.punish = b.punish;
    for (const k of ['maxChannelDeletes', 'maxRoleDeletes', 'maxBans', 'maxKicks']) {
      if (b[k] !== undefined) s.antiNuke[k] = Math.max(1, Math.min(parseInt(b[k], 10) || 3, 50));
    }
    if (b.alertChannelId !== undefined) s.antiNuke.alertChannelId = String(b.alertChannelId || '').slice(0, 25);
    if (b.whitelistIds !== undefined) {
      const rx = /^\d{5,25}$/;
      s.antiNuke.whitelistIds = String(b.whitelistIds || '').split(/[\s,]+/).filter((x) => rx.test(x)).slice(0, 20);
    }
  });
  audit(req, 'تحديث Anti-Nuke', c.guild.name);
  res.json({ ok: true });
});

// ================= Lockdown =================
router.post('/server/:botId/:guildId/lockdown', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const lock = !!req.body.lock;
  try {
    const done = await require('../../src/bot/features/lockdown').setLock(c.client, c.botId, c.guild, lock);
    audit(req, lock ? '🔒 قفل السيرفر' : '🔓 فك القفل', `${c.guild.name} (${done} قناة)`);
    res.json({ ok: true, channels: done });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= Menu Roles =================
router.post('/server/:botId/:guildId/menuroles/save', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const panel = req.body.panel || {};
  const rx = /^\d{5,25}$/;
  const clean = {
    id: String(panel.id || Date.now()).slice(0, 30),
    channelId: String(panel.channelId || ''),
    title: String(panel.title || '🎭 اختار رتبتك').slice(0, 200),
    messageId: panel.messageId || '',
    roles: (panel.roles || [])
      .filter((r) => rx.test(r.id || '') && (r.label || '').trim())
      .slice(0, 25)
      .map((r) => ({ id: r.id, label: String(r.label).trim().slice(0, 100), emoji: String(r.emoji || '').slice(0, 8) })),
  };
  if (!clean.roles.length) return res.status(400).json({ error: 'ضيف رتبة واحدة على الأقل' });

  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.menuRoles.panels = [
      ...(s.menuRoles.panels || []).filter((p) => p.id !== clean.id),
      clean,
    ].slice(-20);
  });
  res.json({ ok: true, panel: clean });
});

router.post('/server/:botId/:guildId/menuroles/post', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  const panel = (s.menuRoles.panels || []).find((p) => p.id === String(req.body.id || ''));
  if (!panel) return res.status(404).json({ error: 'القائمة مش موجودة' });
  try {
    await require('../../src/bot/features/menuRoles').postPanel(c.client, c.botId, c.guild, panel);
    audit(req, 'نشر قائمة رتب', `${panel.title} في ${c.guild.name}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/server/:botId/:guildId/menuroles/delete', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const id = String(req.body.id || '');
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.menuRoles.panels = s.menuRoles.panels.filter((p) => p.id !== id);
  });
  res.json({ ok: true });
});

// ================= XP =================
router.post('/server/:botId/:guildId/xp/settings', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.xp.enabled = !!b.enabled;
    s.xp.xpPerMessage = Math.max(1, Math.min(parseInt(b.xpPerMessage, 10) || 10, 100));
    s.xp.cooldownSeconds = Math.max(5, Math.min(parseInt(b.cooldownSeconds, 10) || 60, 600));
    if (b.announceChannelId !== undefined) s.xp.announceChannelId = String(b.announceChannelId || '').slice(0, 25);
    if (b.levelUpMessage) s.xp.levelUpMessage = String(b.levelUpMessage).slice(0, 300);
  });
  audit(req, 'تحديث إعدادات XP', c.guild.name);
  res.json({ ok: true });
});

router.get('/server/:botId/:guildId/xp/leaderboard', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const lb = require('../../src/bot/features/xp').leaderboard(c.botId, c.guild.id, 15)
    .map((row) => {
      const m = c.guild.members.cache.get(row.userId);
      return { ...row, tag: m ? m.user.tag : row.userId, avatar: m?.user.displayAvatarURL({ size: 64 }) || null };
    });
  res.json({ ok: true, leaderboard: lb });
});

// ================= صورة الترحيب =================
router.post('/server/:botId/:guildId/welcomeimage/settings', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  const hex = (v, fb) => (/^#[0-9a-f]{6}$/i.test(v || '') ? v : fb);
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.welcomeImage.enabled = !!b.enabled;
    s.welcomeImage.bgColor1 = hex(b.bgColor1, '#8b5cf6');
    s.welcomeImage.bgColor2 = hex(b.bgColor2, '#4c1d95');
    s.welcomeImage.textColor = hex(b.textColor, '#ffffff');
  });
  res.json({ ok: true });
});

router.post('/server/:botId/:guildId/welcomeimage/test', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  const ch = s.welcome.channelId && c.guild.channels.cache.get(s.welcome.channelId);
  if (!ch?.isTextBased()) return res.status(400).json({ error: 'حدد روم الترحيب الأول واحفظه' });
  try {
    const buf = await require('../../src/bot/features/welcomeImage').renderWelcome(c.guild.members.me, s.welcomeImage);
    const { AttachmentBuilder } = require('discord.js');
    await ch.send({ files: [new AttachmentBuilder(buf, { name: 'welcome-test.png' })], content: '🖼️ معاينة صورة الترحيب:' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= Auto-Poster =================
router.post('/server/:botId/:guildId/autoposter/add', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  const item = {
    id: String(Date.now()),
    channelId: String(b.channelId || ''),
    content: String(b.content || '').slice(0, 1500),
    everyHours: Math.max(0, Math.min(parseFloat(b.everyHours) || 0, 720)),
    dailyTime: /^\d{2}:\d{2}$/.test(b.dailyTime || '') ? b.dailyTime : '',
    lastSent: 0,
  };
  if (!item.channelId || !item.content) return res.status(400).json({ error: 'اختار الروم واكتب المحتوى' });
  if (!item.everyHours && !item.dailyTime) return res.status(400).json({ error: 'حدد تكرار بالساعات أو وقت يومي' });
  storage.updateGuild(c.botId, c.guild.id, (s) => { s.autoPoster = [...(s.autoPoster || []), item].slice(-30); });
  audit(req, 'إضافة رسالة مجدولة', c.guild.name);
  res.json({ ok: true, item });
});

router.post('/server/:botId/:guildId/autoposter/delete', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const id = String(req.body.id || '');
  storage.updateGuild(c.botId, c.guild.id, (s) => { s.autoPoster = s.autoPoster.filter((x) => x.id !== id); });
  res.json({ ok: true });
});

router.post('/server/:botId/:guildId/autoposter/send-now', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const id = String(req.body.id || '');
  const s = storage.getGuild(c.botId, c.guild.id);
  const item = s.autoPoster.find((x) => x.id === id);
  if (!item) return res.status(404).json({ error: 'مش موجودة' });
  const ch = c.guild.channels.cache.get(item.channelId);
  if (!ch?.isTextBased()) return res.status(400).json({ error: 'روم غير صالح' });
  await ch.send({ content: item.content }).catch((e) => res.status(500).json({ error: e.message }));
  storage.updateGuild(c.botId, c.guild.id, (st) => {
    const it = st.autoPoster.find((x) => x.id === id);
    if (it) it.lastSent = Date.now();
  });
  res.json({ ok: true });
});

// ================= الاقتراحات =================
router.post('/server/:botId/:guildId/suggestions/settings', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.suggestions.enabled = !!req.body.enabled;
    s.suggestions.channelId = String(req.body.channelId || '').slice(0, 25);
  });
  audit(req, 'تحديث نظام الاقتراحات', c.guild.name);
  res.json({ ok: true });
});

// ================= القعود الدائم في صوتية =================
router.get('/server/:botId/:guildId/voicestay', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  res.json({
    ok: true,
    enabled: !!s.voiceStay?.enabled,
    channelId: s.voiceStay?.channelId || '',
    inChannel: c.guild.members.me?.voice?.channelId || null,
  });
});

router.post('/server/:botId/:guildId/voicestay', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  if (b.enabled && !b.channelId) return res.status(400).json({ error: 'اختار الروم الصوتية الأول' });
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.voiceStay.enabled = !!b.enabled;
    s.voiceStay.channelId = b.enabled ? String(b.channelId || '').slice(0, 25) : '';
  });
  try {
    const vs = require('../../src/bot/features/voiceStay');
    if (b.enabled) {
      await vs.joinIfEnabled(c.client, c.botId, c.guild);
      audit(req, '🔊 تفعيل القعود الصوتي', `${c.guild.name} → ${c.guild.channels.cache.get(String(b.channelId))?.name || b.channelId}`);
    } else {
      await vs.leaveNow(c.client, c.botId, c.guild);
      audit(req, '🔇 تعطيل القعود الصوتي', c.guild.name);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'اتحفظت الإعدادات بس فشل الحركة: ' + e.message });
  }
});

// ===== الرد التلقائي (AI): تفعيل على قناة كتابة معينة في السيرفر =====
router.get('/server/:botId/:guildId/ai', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  res.json({
    ok: true,
    enabled: !!s.ai?.enabled,
    hasKey: !!config.geminiApiKey,
    channelId: s.ai?.channelId || '',
  });
});

router.post('/server/:botId/:guildId/ai', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  const want = !!b.enabled;
  const chId = String(b.channelId || '').replace(/\D/g, '').slice(0, 25);

  storage.updateGuild(c.botId, c.guild.id, (s) => {
    s.ai.enabled = want;
    s.ai.channelId = want ? chId : '';
  });

  if (want) audit(req, '🤖 تفعيل الرد التلقائي', c.guild.name + (chId ? ' (قناة محددة)' : ' (كل القنوات)'));
  else audit(req, '🤖 تعطيل الرد التلقائي', c.guild.name);

  res.json({ ok: true });
});

// ===== نظام الستريك (Streaks) للبنات: لايك + عدّاد على صور الفروم =====
router.get('/server/:botId/:guildId/streaks', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  const data = s.streaks?.data || {};
  const meta = s.streaksMeta || {};
  const users = Object.keys(data).map((uid) => ({
    userId: uid,
    count: data[uid]?.count || 0,
    shields: data[uid]?.shields || 0,
    best: meta[uid]?.best || data[uid]?.count || 0,
  })).sort((a, b) => b.count - a.count).slice(0, 50);

  res.json({
    ok: true,
    enabled: !!s.streaks?.enabled,
    forumChannelId: s.streaks?.forumChannelId || '',
    announceChannelId: s.streaks?.announceChannelId || '',
    senderBotId: s.streaks?.senderBotId || '',
    users,
  });
});

router.post('/server/:botId/:guildId/streaks', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const b = req.body;
  const want = !!b.enabled;
  const forum = String(b.forumChannelId || '').replace(/\D/g, '').slice(0, 25);
  const announce = String(b.announceChannelId || '').replace(/\D/g, '').slice(0, 25);
  const senderBotId = String(b.senderBotId || '').replace(/\D/g, '').slice(0, 25);

  // نخزن الإعداد في كل البوتات اللي في نفس السيرفر — عشان أي بوت يشوف الإعداد نفسه
  const allClients = [...(pool.clients?.keys() || [])];
  for (const bid of allClients) {
    const cl = pool.get(bid);
    if (!cl || !cl.isReady()) continue;
    const g = cl.guilds.cache.get(c.guild.id);
    if (!g) continue;

    storage.updateGuild(bid, c.guild.id, (s) => {
      s.streaks.enabled = want;
      s.streaks.forumChannelId = want ? forum : '';
      s.streaks.announceChannelId = announce || '';
      s.streaks.senderBotId = want && senderBotId ? senderBotId : '';
    });
  }

  if (want) audit(req, '🔥 تفعيل نظام الستريك', c.guild.name + (forum ? ' (فروم: ' + forum + ')' : ''));
  else audit(req, '🔥 تعطيل نظام الستريك', c.guild.name);

  res.json({ ok: true });
});

// ===== تفعيل القعود لكل البوتات وكل الرومات تلقائي =====
router.post('/voice-join-all', requireMin('admin'), async (req, res) => {
  const vs = require('../../src/bot/features/voiceStay');
  const results = [];

  for (const entry of storage.getBots()) {
    const client = pool.get(entry.id);
    if (!client || !client.isReady()) continue;

    for (const guild of client.guilds.cache.values()) {
      // ندور على أول روم صوتية متاحة
      const voiceChannels = guild.channels.cache.filter((ch) => ch.type === 2);
      if (voiceChannels.size === 0) continue;

      // نختار الروم الصوتية الأولى (أو اللي فيها عضو من البوتات)
      const ch = voiceChannels.first();
      if (!ch) continue;

      // نفعّل القعود
      storage.updateGuild(entry.id, guild.id, (s) => {
        s.voiceStay.enabled = true;
        s.voiceStay.channelId = ch.id;
      });

      try {
        await vs.joinIfEnabled(client, entry.id, guild);
        results.push({ bot: entry.label, guild: guild.name, channel: ch.name, ok: true });
      } catch (e) {
        results.push({ bot: entry.label, guild: guild.name, channel: ch.name, ok: false, error: e.message });
      }
    }
  }

  audit(req, '🔊 تفعيل القعود لكل البوتات', `${results.length} روم`);
  res.json({ ok: true, results });
});

// ================= الميوزك 🎵 =================
const music = require('../../src/bot/features/music');

router.get('/server/:botId/:guildId/music/status', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  res.json({ ok: true, ...music.status(c.client, c.guild.id), botVoice: c.guild.members.me?.voice?.channelId || null });
});

router.post('/server/:botId/:guildId/music/play', async (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    // هدفنا: روم القعود لو مفعلة ← أو أي روم البوت قاعد فيها
    let channelId = c.guild.members.me?.voice?.channelId || null;
    if (!channelId) {
      const s = storage.getGuild(c.botId, c.guild.id);
      if (s.voiceStay?.enabled && s.voiceStay.channelId) {
        await require('../../src/bot/features/voiceStay').joinIfEnabled(c.client, c.botId, c.guild);
        channelId = s.voiceStay.channelId;
      }
    }
    if (!channelId) return res.status(400).json({ error: 'البوت مش في روم صوتية — فعّل القعود الصوتي الأول من تاب 🔊' });
    await music.play(c.client, c.guild, channelId, String(req.body.query || ''));
    audit(req, '🎵 تشغيل أغنية', String(req.body.query || '').slice(0, 60));
    res.json({ ok: true });
  } catch (e) {
    console.error('[MUSIC PLAY ERR]', e.stack || e.message);
    res.status(500).json({ error: /rate|429/i.test(e.message) ? 'يوتيوب بيقفل الطلبات مؤقتًا — استنى دقيقة وجرب' : e.message });
  }
});

function musicAction(action) {
  return (req, res) => {
    const c = ctxOf(req, res); if (!c) return;
    try {
      const q = c.client._disTube?.getQueue(c.guild.id);
      if (!q) return res.status(404).json({ error: 'مفيش حاجة شغالة' });
      if (action === 'pause') q.pause();
      else if (action === 'resume') q.resume();
      else if (action === 'skip') q.skip();
      else if (action === 'stop') q.stop();
      audit(req, `🎵 ${action}`, c.guild.name);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  };
}
router.post('/server/:botId/:guildId/music/pause', musicAction('pause'));
router.post('/server/:botId/:guildId/music/resume', musicAction('resume'));
router.post('/server/:botId/:guildId/music/skip', musicAction('skip'));
router.post('/server/:botId/:guildId/music/stop', musicAction('stop'));

router.post('/server/:botId/:guildId/music/volume', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const q = c.client._disTube?.getQueue(c.guild.id);
    const v = Math.max(0, Math.min(parseInt(req.body.value, 10) || 80, 150));
    if (q) q.setVolume(v);
    res.json({ ok: true, volume: v });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/server/:botId/:guildId/music/remove', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  try {
    const q = c.client._disTube?.getQueue(c.guild.id);
    if (!q) return res.status(404).json({ error: 'مفيش قائمة تشغيل' });
    // index من الواجهة = الترتيب في القائمة المعروضة (من غير اللي بتشتغل)
    // في q.songs العنصر الأول هو اللي بيشتغل → إزاحة +1
    const i = parseInt(req.body.index, 10);
    if (!(i >= 0) || !q.songs[i + 1]) return res.status(400).json({ error: 'رقم الأغنية مش صحيح' });
    q.songs.splice(i + 1, 1);
    audit(req, '🎵 حذف أغنية من القائمة', `#${i}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================= الإحصائيات =================
router.get('/server/:botId/:guildId/stats', (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  res.json({
    ok: true,
    today: { msgs: s.stats.msgsToday, joins: s.stats.joinsToday, leaves: s.stats.leavesToday },
    history: s.stats.history || [],
    memberCount: c.guild.memberCount,
  });
});

// ================= نسخ/لصق الإعدادات =================
router.get('/server/:botId/:guildId/settings/export', requireMin('admin'), (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const s = storage.getGuild(c.botId, c.guild.id);
  delete s.warnings; delete s.xpData; delete s.stats; // بيانات تشغيلية متتنقلش
  res.setHeader('Content-Disposition', `attachment; filename="settings-${c.guild.id}.json"`);
  res.json({ __export: 'wicks-panel-v1', settings: s });
});

router.post('/server/:botId/:guildId/settings/import', requireMin('admin'), (req, res) => {
  const c = ctxOf(req, res); if (!c) return;
  const incoming = req.body.settings;
  if (incoming?.__export !== 'wicks-panel-v1') return res.status(400).json({ error: 'ملف الإعدادات غير صالح' });
  storage.updateGuild(c.botId, c.guild.id, (s) => {
    for (const key of ['protection', 'antiNuke', 'welcome', 'leave', 'autoRole', 'logs',
      'moderation', 'tickets', 'welcomeImage', 'xp', 'menuRoles', 'suggestions']) {
      if (incoming[key] && typeof incoming[key] === 'object') s[key] = incoming[key];
    }
    if (incoming.prefix) s.prefix = String(incoming.prefix).slice(0, 6);
    if (Array.isArray(incoming.customCommands)) s.customCommands = incoming.customCommands.slice(0, 50);
    if (Array.isArray(incoming.whitelistChannels)) s.whitelistChannels = incoming.whitelistChannels;
    if (Array.isArray(incoming.whitelistRoles)) s.whitelistRoles = incoming.whitelistRoles;
    if (Array.isArray(incoming.autoPoster)) s.autoPoster = incoming.autoPoster.slice(0, 30);
  });
  audit(req, 'استيراد إعدادات', `لـ ${c.guild.name}`);
  res.json({ ok: true });
});

// ================= حسابات اللوحة (مالك فقط) =================
router.get('/panel/users', requireMin('owner'), (req, res) => {
  res.json({ ok: true, users: storage.listUsersSafe() });
});
router.post('/panel/users/add', requireMin('owner'), (req, res) => {
  try {
    storage.createUserPanel(req.body.username, req.body.password, req.body.role);
    audit(req, 'إضافة حساب لوحة', `${req.body.username} (${req.body.role})`);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/panel/users/delete', requireMin('owner'), (req, res) => {
  try {
    if (req.body.username === req.session.authUser.username) throw new Error('مينفعش تمسح نفسك');
    storage.deleteUserPanel(req.body.username);
    audit(req, 'حذف حساب لوحة', String(req.body.username));
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/panel/password', (req, res) => {
  const me = req.session.authUser.username;
  try {
    storage.changeUserPassword(me, req.body.current || '', req.body.next1 || '');
    if ((req.body.next2 !== undefined) && req.body.next1 !== req.body.next2) {
      return res.status(400).json({ error: 'التأكيد مش مطابق' });
    }
    audit(req, 'تغيير كلمة سر', me);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// سجل العمليات
router.get('/panel/auditlog', requireMin('admin'), (req, res) => {
  res.json({ ok: true, log: storage.getAudit(300) });
});

module.exports = router;
