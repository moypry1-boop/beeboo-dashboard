// الإعدادات الافتراضية لكل سيرفر
module.exports.DEFAULT_SETTINGS = {
  prefix: '!',
  whitelistChannels: [],
  whitelistRoles: [],
  protection: {
    antiLinks:   { enabled: false, action: 'delete' },
    antiInvites: { enabled: false, action: 'delete' },
    badWords:    { enabled: false, words: [], action: 'delete' },
    antiSpam:    { enabled: false, maxMessages: 6, perSeconds: 5, action: 'timeout' },
    antiMention: { enabled: false, maxMentions: 6, action: 'timeout' },
    antiRaid:    { enabled: false, maxJoins: 6, perMinutes: 1, action: 'kick' },
  },
  welcome: {
    enabled: false, channelId: '', message:
      'أهلاً بك {user} في **{server}** 🎉\nأنت العضو رقم **{memberCount}**',
    embed: true, dmEnabled: false, dmMessage: 'نورت سيرفر {server} 💜',
  },
  leave: {
    enabled: false, channelId: '',
    message: '**{username}** غادر السيرفر 😢\nعدد الأعضاء الآن: {memberCount}',
  },
  autoRole: { enabled: false, roleId: '' },
  logs: {
    enabled: false, channelId: '',
    events: {
      messageDelete: true, messageEdit: true, memberBan: true,
      memberKick: true, roleChanges: true, channelChanges: true,
      nickname: true, joins: true, leaves: true,
    },
  },
  moderation: { modLogChannelId: '' },
  tickets: {
    enabled: false, categoryId: '', supportRoleId: '', panelChannelId: '',
    welcomeMessage: 'أهلاً بك في تذكرتك، اكتب مشكلتك وسيتم الرد عليك قريباً.',
    opened: 0,
  },
  customCommands: [], // { name, response, enabled }
  warnings: {},       // userId -> [{ reason, by, at }]

  // ===== الإضافات الجديدة =====
  antiNuke: {
    enabled: false, punish: 'removeroles', // removeroles | kick | ban
    maxChannelDeletes: 3, maxRoleDeletes: 3, maxBans: 5, maxKicks: 5,
    windowSeconds: 60, whitelistIds: [], alertChannelId: '',
  },
  xp: {
    enabled: false, xpPerMessage: 10, cooldownSeconds: 60,
    announceChannelId: '', levelUpMessage: 'مبروك! وصلت لمستوى **{level}** 🎉',
  },
  xpData: {}, // userId -> { xp, last }
  welcomeImage: { enabled: false, bgColor1: '#8b5cf6', bgColor2: '#4c1d95', textColor: '#ffffff' },
  autoPoster: [],   // { id, channelId, content, everyHours (0=معطل), dailyTime ('HH:MM' أو ''), lastSent }
  suggestions: { enabled: false, channelId: '', items: [] }, // items: [{ messageId, status }]
  menuRoles: { panels: [] }, // { id, channelId, messageId, title, roles:[{id,label}] }
  stats: { msgsToday: 0, joinsToday: 0, leavesToday: 0, dateKey: '', history: [] }, // history: [{date,msgs,joins}]
  lockedDown: false,
  voiceStay: { enabled: false, channelId: '' }, // قعود دائم في روم صوتية
  ai: { enabled: false, channelId: '' }, // الرد التلقائي في قناة كتابة — أي حد يكتب هيرد عليه
  streaks: {
    enabled: false, forumChannelId: '', announceChannelId: '',
    data: {}, // userId -> { count, lastDay, shields }
  },
  streaksMeta: {}, // userId -> أعلى ستريك وصلتله (best)
};

// دمج عميق بسيط مع الحفاظ على القيم الموجودة
function mergeDefaults(target, defaults) {
  const out = Array.isArray(defaults) ? (Array.isArray(target) ? target : JSON.parse(JSON.stringify(defaults))) : {};
  if (!target || typeof target !== 'object' || Array.isArray(target) || Array.isArray(defaults)) {
    return Array.isArray(defaults)
      ? (Array.isArray(target) ? target : JSON.parse(JSON.stringify(defaults)))
      : (target && typeof target === 'object' ? target : out);
  }
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const t = target[key];
    if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
      out[key] = mergeDefaults(t || {}, d);
    } else if (Array.isArray(d)) {
      out[key] = Array.isArray(t) ? t : JSON.parse(JSON.stringify(d));
    } else {
      out[key] = t === undefined ? d : t;
    }
  }
  // احتفظ بأي مفاتيح إضافية موجودة (مثل warnings و customCommands)
  for (const key of Object.keys(target)) {
    if (!(key in out)) out[key] = target[key];
  }
  return out;
}

module.exports.mergeDefaults = mergeDefaults;
