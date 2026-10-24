// القعود الدائم في روم صوتية — البوت يرجع يدخل لو حد طلعه
const storage = require('../../storage');
const { Events } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState, getVoiceConnection } = require('@discordjs/voice');

const _lastAttempt = new Map();
const _failCount = new Map();
const COOLDOWN_MS = 10 * 1000; // 10 ثانية بين محاولات الدخول
const MAX_FAILS = 20;

function botGuildKey(botId, guildId) { return `${botId}_${guildId}`; }

// تعيينات الصوت الثابتة (أولوية قصوى — ولو الـ storage اتلخبط نرجع للسليم)
const VOICE_ASSIGNMENTS = {
  '1536510357370314812': '1536635011162308638',
  '1536518247950590032': '1536589886889529465',
  '1536553370502832178': '1536589881055117434',
  '1536612024208068608': '1536589878106787920',
  '1536612088770994176': '1536589890299502733',
  '1536612140872368248': '1536589893000499291',
  '1536612213245354094': '1536589896700002366',
  '1536612272493953084': '1536589899631960134',
  '1536612331654742128': '1536589903301840996',
};

function targetOf(botId, guild) {
  // 1) الروم الثابت في الكود أولاً — دي الحقيقة المطلقة
  const fixed = VOICE_ASSIGNMENTS[botId];
  if (fixed) {
    const fch = guild.channels.cache.get(fixed);
    if (fch && fch.type === 2) return fch;
  }
  // 2) بعدين الـ storage لو فيه روم
  const s = storage.getGuild(botId, guild.id);
  if (!s.voiceStay?.enabled || !s.voiceStay.channelId) return null;
  const ch = guild.channels.cache.get(s.voiceStay.channelId);
  return ch && ch.type === 2 ? ch : null;
}

async function joinIfEnabled(client, botId, guild) {
  const ch = targetOf(botId, guild);
  if (!ch) return false;
  const me = guild.members.me;
  const key = botGuildKey(botId, guild.id);

  // لو البوت قاعد في الروم الصح، نتأكد الاتصال شغال
  if (me?.voice?.channelId === ch.id) {
    const conn = client._voiceConn;
    if (conn && conn.state?.status === VoiceConnectionStatus.Ready) {
      _failCount.set(key, 0);
      return true;
    }
    if (conn) return true;
  }

  // cooldown
  const lastAttempt = _lastAttempt.get(key) || 0;
  if (Date.now() - lastAttempt < COOLDOWN_MS) return false;

  const fails = _failCount.get(key) || 0;
  if (fails >= MAX_FAILS) {
    if (fails === MAX_FAILS) {
      console.warn(`[VOICE STAY ${botId}] توقف عن المحاولة — ${MAX_FAILS} محاولات فاشلة`);
      _failCount.set(key, fails + 1);
    }
    return false;
  }

  _lastAttempt.set(key, Date.now());

  // لو البوت في روم صوتية تانية، نطلع الأول
  if (me?.voice?.channelId && me.voice.channelId !== ch.id) {
    try {
      if (client._voiceConn) {
        try { client._voiceConn.destroy(); } catch {}
        client._voiceConn = null;
      }
      await me.voice.disconnect().catch(() => {});
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  try {
    // group = botId عشان كل بوت ليه اتصال مستقل — مش بيتخطفوا
    const conn = joinVoiceChannel({
      channelId: ch.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      group: botId,
      daveEncryption: true, // DAVE إلزامي في ديسكورد (أبريل 2026)
    });

    // نخزّن الاتصال على الـ client عشان listen/tts/ws-voice يلقواه
    client._voiceConn = conn;

    conn.on('stateChange', (_o, n) => {
      // نرصد تطور الحالة — المفروض: signalling → connecting → ready
      console.log(`[VOICE STAY ${botId}] state → ${n.status}${n.networking?.state ? ` | net=${n.networking.state.code}` : ''}`);
    });

    conn.on('error', (err) => {
      console.warn(`[VOICE ERR ${botId}] ${err?.message || String(err)}`);
    });

    conn.on('debug', (m) => {
      const s = typeof m === 'string' ? m : JSON.stringify(m);
      if (String(s).includes('NW') || String(s).includes('WS')) {
        const one = s.replace(/\n+/g, ' ⏎ ');
        console.log(`[VOICE DBG ${botId}] ${one.slice(0, 700)}`);
      }
    });

    // نستنى الاتصال يثبت فعلاً (Ready) — لو محجوب UDP هيعلق هنا ويكشف المشكلة
    try {
      await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
      _failCount.set(key, 0);
      console.log(`[VOICE STAY ${botId}] دخل ${ch.name} في ${guild.name} ✅ READY`);
    } catch (e) {
      // ما وصلش Ready — لازم نعرف واقف فين بالظبط
      const stuck = conn.state?.status;
      const net = conn.state?.networking?.state?.code;
      if (stuck === VoiceConnectionStatus.Signalling) {
        // الاتصال واقف في signalling (الـ WS لسه بيحاول يعيد) —
        // لو عملنا destroy هينزل البوت من الروم ويطلع ويخش في لفة لا نهائية
        // الأفضل نسيبها تحاول لوحدها والـ VoiceConnection بيعيد من نفسه،
        // والبوت يفضل ظاهر في الروم (بريزنس بس — الصوت بيفشل لسبب WS)
        console.log(`[VOICE STAY ${botId}] ${ch.name}: واقف في signalling (net=${net}) — بنسيبها تحاول والبوت فاضل ظاهر في الروم`);
        return true;
      }
      _failCount.set(key, fails + 1);
      try { conn.destroy(); } catch {}
      if (client._voiceConn === conn) client._voiceConn = null;
      console.warn(`[VOICE STAY ${botId}] ${ch.name}: الاتصال ما اكتملش Ready — state=${stuck} net=${net} — ${e.message} (${fails + 1}/${MAX_FAILS})`);
      return false;
    }

    conn.on(VoiceConnectionStatus.Destroyed, () => {
      if (client._voiceConn === conn) client._voiceConn = null;
    });

    // لما الاتصال الصوتي ينقطع — نرجّع فوراً وبقوة بدل ما نستنى
    conn.on(VoiceConnectionStatus.Disconnected, async () => {
      const keyC = botGuildKey(botId, guild.id);
      // مسح الـ cooldown عشان نسمح بإعادة دخول فورية
      _lastAttempt.delete(keyC);
      _failCount.delete(keyC);
      console.log(`[VOICE STAY ${botId}] الاتصال انقطع — برجّع فوراً في الروم...`);

      const reconnect = async (tryN = 0) => {
        try {
          const meNow = guild.members.me;
          if (!meNow?.voice?.channelId || meNow.voice.channelId !== ch.id) {
            // البوت طلع من الروم — ندخله من جديد
            const ok = await joinIfEnabled(client, botId, guild);
            if (ok) return true;
            if (tryN < 3) {
              await new Promise(r => setTimeout(r, 2500 * (tryN + 1)));
              return reconnect(tryN + 1);
            }
            return false;
          }
          // البوت لسه ظاهر في الروم بس الاتصال ضايع — نعيد الاتصال بنفس الروم
          if (client._voiceConn && client._voiceConn.state?.status !== VoiceConnectionStatus.Ready) {
            try { conn.destroy(); } catch {}
            if (client._voiceConn === conn) client._voiceConn = null;
            await new Promise(r => setTimeout(r, 800));
            const ok = await joinIfEnabled(client, botId, guild);
            if (ok) return true;
            if (tryN < 3) {
              await new Promise(r => setTimeout(r, 2500 * (tryN + 1)));
              return reconnect(tryN + 1);
            }
          }
          return true; // ظاهر في الروم صح خلاص
        } catch (e) {
          console.warn(`[VOICE STAY ${botId}] خطأ في الإعادة:`, e.message);
          return false;
        }
      };

      // نحاول الإعادة فوراً
      reconnect();
    });

    return true;
  } catch (e) {
    _failCount.set(key, fails + 1);
    console.warn(`[VOICE STAY ${botId}] فشل الدخول لـ ${ch.name}: ${e.message} (${fails + 1}/${MAX_FAILS})`);
    return false;
  }
}

async function leaveNow(client, botId, guild) {
  client._vsLeaveUntil = Date.now() + 500;
  const key = botGuildKey(botId, guild.id);
  _failCount.set(key, 0);
  if (client._voiceConn) {
    try { client._voiceConn.destroy(); } catch {}
    client._voiceConn = null;
  }
  const me = guild.members.me;
  if (me?.voice?.channelId) {
    await me.voice.disconnect().catch(() => {});
  }
  return true;
}

// Health check — كل 20 ثانية: بيرجع البوت فوراً لو طلع من الروم أو الاتصال راح
let _healthInterval = null;
function startHealthCheck() {
  if (_healthInterval) return;
  _healthInterval = setInterval(async () => {
    const pool = require('../pool');
    let delay = 0;
    for (const [botId, channelId] of Object.entries(VOICE_ASSIGNMENTS)) {
      try {
        const client = pool.get(botId);
        if (!client || !client.isReady()) continue;
        for (const guild of client.guilds.cache.values()) {
          const s = storage.getGuild(botId, guild.id);
          if (!s.voiceStay?.enabled || !s.voiceStay.channelId) continue;
          const me = guild.members.me;
          const target = s.voiceStay.channelId;
          if (me?.voice?.channelId !== target) {
            // نأخّر كل إعادة دخول عشان ما نضغطش على Discord
            await new Promise(r => setTimeout(r, delay));
            delay += 2000;
            console.log(`[VOICE HEALTH] ${botId} مش في الروم — برجع تاني فوراً...`);
            _lastAttempt.delete(botGuildKey(botId, guild.id));
            _failCount.delete(botGuildKey(botId, guild.id));
            await joinIfEnabled(client, botId, guild);
          }
        }
      } catch {}
    }
  }, 20 * 1000);
}

module.exports = function register(client) {
  client.once(Events.ClientReady, () => {
    // نأخّر الدخول الصوتي عشان Discord ما يرفضش اتصالات كتير من نفس الـ IP
    // كل بوت ليه delay فريد بناءً على ترتيبه
    const botIds = Object.keys(VOICE_ASSIGNMENTS);
    const botIndex = botIds.indexOf(client._botId);
    const STAGGER_DELAY = 3000; // 3 ثانية بين كل بوت والتاني
    const myDelay = 3000 + (botIndex >= 0 ? botIndex * STAGGER_DELAY : 0);

    setTimeout(async () => {
      const botId = client._botId;

      const fixedChannel = VOICE_ASSIGNMENTS[botId];
      if (fixedChannel) {
        for (const guild of client.guilds.cache.values()) {
          const ch = guild.channels.cache.get(fixedChannel);
          if (ch && ch.type === 2) {
            storage.updateGuild(botId, guild.id, (g) => {
              g.voiceStay.enabled = true;
              g.voiceStay.channelId = fixedChannel;
            });
            storage.setVoiceAssignment(botId, fixedChannel);
            console.log(`[VOICE STAY ${botId}] تم تعيين ${ch.name}`);
          }
        }
      }

      for (const guild of client.guilds.cache.values()) {
        try {
          const s = storage.getGuild(botId, guild.id);
          if (s.voiceStay?.enabled && s.voiceStay.channelId) {
            await joinIfEnabled(client, botId, guild);
            continue;
          }
          const mapChannel = storage.getVoiceAssignment(botId);
          if (mapChannel) {
            const ch = guild.channels.cache.get(mapChannel);
            if (ch && ch.type === 2) {
              storage.updateGuild(botId, guild.id, (g) => {
                g.voiceStay.enabled = true;
                g.voiceStay.channelId = mapChannel;
              });
              await joinIfEnabled(client, botId, guild);
            }
          }
        } catch (e) {
          console.error(`[VOICE STAY ${botId}]`, e.message);
        }
      }

      startHealthCheck();
    }, myDelay);
  });

  client.on(Events.VoiceStateUpdate, async (oldS, newS) => {
    if (oldS.id !== client.user.id) return;
    const botId = client._botId;
    const guild = oldS.guild || newS.guild;
    if (!guild) return;

    const st = storage.getGuild(botId, guild.id);
    if (!st.voiceStay?.enabled || !st.voiceStay.channelId) return;
    const target = st.voiceStay.channelId;
    if (newS.channelId === target) return;
    if (client._vsLeaveUntil && Date.now() < client._vsLeaveUntil) return;

    console.log(`[VOICE STAY ${botId}] طُلع من الروم — برجع تاني...`);
    const key = botGuildKey(botId, guild.id);
    _lastAttempt.delete(key);
    _failCount.delete(key);

    // نأخّر شوية قبل ما نرجع — عشان Discord ما يرفضش
    setTimeout(async () => {
      try {
        const fresh = storage.getGuild(botId, guild.id);
        if (!fresh.voiceStay?.enabled || fresh.voiceStay.channelId !== target) return;
        const me2 = guild.members.me;
        if (me2?.voice?.channelId === target) return;
        await joinIfEnabled(client, botId, guild);
      } catch (e) {
        console.error(`[VOICE STAY ${botId}]`, e.message);
      }
    }, 5000);
  });
};

module.exports.joinIfEnabled = joinIfEnabled;
module.exports.leaveNow = leaveNow;
