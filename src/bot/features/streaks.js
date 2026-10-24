// ===== Streaks للبنات — زي الستريك بتاع Snapchat
// البنات بتنزّل صور كل يوم في قناة فروم محددة، والبوت:
// 1) يعمل لايك (❤️🔥) على الصورة
// 2) يحدّث عداد الستريك (أيام متتالية)
// 3) يبعت منشن حلو فيه العداد والدروع (حماية لو فات يوم)
const storage = require('../../storage');

const MAX_SHIELDS = 3;

// ===== التواريخ (بتوقيت محلي للسيرفر/الجهاز) =====
function dateKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function yesterdayKey() {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dateKey(y);
}

// ===== رسائل حلوة للبنات حسب قوة الستريك =====
const MILESTONE_LINES = {
  3: ['٣ أيام متتالية! 🔥 بيكفي ديبستارت', 'ثلاثة أيام، بتحطي! 🌟'],
  7: ['أسبوع كامل يا بطلة! 🏆 سبعة أيام من الكيوينس', 'أسبوع! دي المرأة الرسمية للقناة 👑'],
  10: ['عشرة أيام! 🔟 دي أرقام السوبر ستار', 'عشرة ده الوضع دخل طور الجد يييي 🔥'],
  15: ['١٥ يوم! قمر القناة أكيد 🌙', 'خمستاشر يوم متتالية.. احترامي بجد 🙌'],
  30: ['شهر كامل يا ملكة! 🏆👑 الثبات ده مش طبيعي', '٣٠ يوم ستريك، الناس دي أسطورة القناة 🔥'],
  50: ['٥٠ يوم! بصي على اللي وراكي يا كوين 👑 كان فيه ٥٠ يوم بجد؟', 'نص مية! الستريك ده أقوى من أي ستريك في ديسكورد 🚀'],
  100: ['١٠٠ يوم!! أسطورة القناة الرسمية 👑🔥 ما شاء الله عليكي', 'مية يوم ستريك! القناة كلها بترفعلك قبعتها 🎩'],
};

// ===== إزالة الإيموجي الرابط من بداية الرسالة (تبقى الصورة دي منشن لرد) =====
function stripMentions(t) {
  return String(t || '').replace(/<@!?&?\d+>/g, '').trim();
}

// ===== هل البوت شغال للستريك في السيرفر ده؟ =====
// الأولوية: db config (من اللوحة) → لو مش مفعّل، نشوف env (تفعيل تلقائي)
function getCfg(botId, guildId) {
  const s = storage.getGuild(botId, guildId);
  if (s.streaks?.enabled) return s.streaks;

  // تفعيل تلقائي من متغيرات البيئة (زي الـ AI بالظبط)
  const autoCh = process.env.STREAKS_CHANNEL_ID;
  if (autoCh) {
    const cfg = s.streaks || {};
    cfg.forumChannelId = autoCh;
    if (!cfg.announceChannelId && process.env.STREAKS_ANNOUNCE_CHANNEL_ID) {
      cfg.announceChannelId = process.env.STREAKS_ANNOUNCE_CHANNEL_ID;
    }
    cfg.data = cfg.data || {};
    return cfg;
  }
  return null;
}

// ===== إرسال رسالة الستريك الحلوة =====
// شكل رسالة جميل (Embed) — كلام حلو + عداد + دروع (خفيفة) بدون شكل فاضي
// الاتجاه الافتراضي: ردّ (Reply) على الرسالة نفسها عشان تبان الصورة
async function sendStreakMessage(client, cfg, guildId, userId, memberName, state, isFirstToday, replyMsg) {
  const g = client.guilds.cache.get(guildId);
  if (!g) return;

  // قناة الاستقبال: announceChannelId لو محدد (رسالة عادية)، والا reply على الصورة نفسها
  let ch = null;
  if (cfg.announceChannelId) ch = g.channels.cache.get(cfg.announceChannelId) || null;
  if (!ch && !replyMsg) return;

  // كلام حلو مخصوص للستريك دايماً (مش بس الأيام الكبيرة)
  const STARTER = [
    'تسلمي يا قمر، استمري كده 💕',
    'شكلك كده بجد، استمري يا جوهرة ✨',
    'الصورة تحفة! عاش يا بديعة 💖',
    'يوم جديد وستريك أجمل 🌸',
    'بجد انتي بطلة، استمري 🔥',
    'الإطلالة جامدة، والستريك أحلى 💅',
    'ملكة القناة جاية تاني يا ولاد 👑',
    'التزامك خارق للعادة فعلًا 🌟',
  ];

  // حدد الرسالة الحلوة: الأيام الكبيرة ليها رسايل خاصة
  let sweet = STARTER[Math.floor(Math.random() * STARTER.length)];
  if (isFirstToday && state.count > 1) {
    const imp = MILESTONE_LINES[state.count];
    if (imp) sweet = imp[Math.floor(Math.random() * imp.length)];
  }

  // الدروع: نعرضها بس لو فيه درع فعلي (بشكل محبب، من غير فراغات بيضة)
  let fieldShields = null;
  if (state.shields > 0) {
    fieldShields = '🛡️'.repeat(state.shields);
  }

  const desc = `<@${userId}>`;
  const embed = {
    color: 0xff7ac6, // وردي حلو
    description: desc,
    fields: [],
    footer: { text: `🔥 في قمة التحدي — استمري يا ملكة 🌸` },
    timestamp: new Date().toISOString(),
  };

  // سطر الإنجاز (أول مرة النهارده وعداد أكبر من 1)
  if (isFirstToday && state.count > 1) {
    embed.fields.push({ name: `🔥 عداد الستريك`, value: `${state.count} يوم متتالية`, inline: true });
    if (fieldShields) embed.fields.push({ name: `🛡️ الحماية`, value: fieldShields, inline: true });
    embed.fields.push({ name: `💬 رسالة اليوم`, value: sweet });
  } else if (isFirstToday) {
    // أول يوم — تشجيع
    embed.fields.push({ name: `🔥 عداد الستريك`, value: `بدأ يومك الأول 🔥`, inline: true });
    embed.fields.push({ name: `💬 رسالة اليوم`, value: sweet });
  } else {
    // رسالة مكررة النهارده (أول رسالة اتقفلت)
    embed.fields.push({ name: `🔥 عداد الستريك`, value: `${state.count} يوم متتالية`, inline: true });
    embed.fields.push({ name: `💬 رسالة اليوم`, value: 'استمري — ستريكك محفوظ ليكي النهارده 💕' });
  }

  try {
    if (ch) await ch.send({ embeds: [embed] });
    else await replyMsg.reply({ embeds: [embed] });
  } catch (e) {
    console.error('[STREAK] فشل إرسال:', e.message);
  }
}

// ===== معالجة رسالة في قناة الفروم =====
async function handlePost(client, msg) {
  try {
    // الرسالة لازم تكون صورة/مرفق أصلاً، ومن شخص مش بوت
    if (msg.author?.bot) return;
    if (!msg.guild) return;

    const cfg = getCfg(client._botId, msg.guild.id);
    if (!cfg) return;
    if (!cfg.forumChannelId) return;

    // تحقق إن القناة هي الفروم (أو ثريد تابع ليه)
    const ch = msg.channel;
    const isTarget =
      String(ch.id) === String(cfg.forumChannelId) ||
      (ch.isThread?.() && ch.parentId && String(ch.parentId) === String(cfg.forumChannelId));

    if (!isTarget) return;

    // مهم: الستريك للصور بس — لو الرسالة مفيش فيها صورة نطلع فورًا
    const hasImage =
      (msg.attachments?.size || 0) > 0 ||
      (msg.stickers?.size || 0) > 0 ||
      /(cdn\.discordapp\.com\/attachments|media\.discordapp\.net\/attachments|\.(png|jpe?g|gif|webp|bmp)\b)/i.test(msg.content || '');
    if (!hasImage) return;

    // كل البوتات تعمل لايك (❤️🔥) على الصورة — ده المطلوب الكل يساهم
    // ❤️🔥 مركّب ممكن يفشل — بنعمل لايكين منفصلين عشان نضمن
    for (const emoji of ['❤️', '🔥']) {
      try {
        await msg.react(emoji);
      } catch (e) {
        console.error(`[STREAK] فشل لايك ${emoji} من ${client._botId}:`, e.message);
      }
    }

    // مين البوت المسؤول عن حساب الستريك وإرسال الرسالة؟
    // الأولوية لإعداد اللوحة (cfg.senderBotId) وإلا env
    const senderId = ((cfg && cfg.senderBotId) || process.env.STREAKS_SENDER_BOT_ID || '').toString().trim();
    if (!senderId) return; // مش محدد → حماية من السبام (كلهم لايكات بس)
    if (String(client._botId) !== String(senderId)) return; // مش البوت المرسل → لايك بس

    // نحدّث الستريك
    const today = dateKey();
    const yest = yesterdayKey();
    const uid = msg.author.id;
    const prev = cfg.data?.[uid] || { count: 0, lastDay: '', shields: 0 };

    let newState;
    if (prev.lastDay === today) {
      // نزلت النهارده قبل كده — نقفل عداد بس متزيدش
      newState = { ...prev };
      sendStreakMessage(client, cfg, msg.guild.id, uid, msg.author.username, newState, false, msg);
      return;
    }

    if (prev.lastDay === yest) {
      // يوم متتالي ✓
      newState = {
        count: prev.count + 1,
        lastDay: today,
        shields: Math.min(MAX_SHIELDS, prev.shields + 1),
      };
    } else {
      // لو كان فات يوم:
      //   لو معاك درع حماية → استخدمه والستريك يكمّل
      //   لو لأ → يبدأ من جديد من 1
      if (prev.shields > 0 && prev.count > 0) {
        newState = {
          count: prev.count + 1,
          lastDay: today,
          shields: prev.shields - 1,
        };
      } else {
        newState = { count: 1, lastDay: today, shields: 0 };
      }
    }

    // حفظ
    storage.updateGuild(client._botId, msg.guild.id, (s) => {
      s.streaks.data = s.streaks.data || {};
      s.streaks.data[uid] = newState;
      const best = s.streaksMeta?.[uid]?.best || 0;
      if (newState.count > best) {
        s.streaksMeta = s.streaksMeta || {};
        s.streaksMeta[uid] = { best: newState.count };
      }
    });

    sendStreakMessage(client, cfg, msg.guild.id, uid, msg.author.username, newState, true, msg);
  } catch (e) {
    console.error('[STREAK] message:', e.message);
  }
}

function register(client) {
  if (process.env.STREAKS_CHANNEL_ID) {
    console.log(`[STREAK] تفعيل تلقائي على الفروم ${process.env.STREAKS_CHANNEL_ID} (env)`);
  } else {
    // تلخيص في بداية التشغيل: فين الستريك مفعّل فعلاً
    try {
      const pool = client._db?.get('bots') || [];
      const list = [];
      for (const b of pool) {
        const bots = (b.tokens || []).filter((t) => t.enabled);
        for (const t of bots) {
          const gs = (b.guilds || []).filter((g) => g.streaks?.enabled);
          for (const g of gs) list.push(`${t.botId}:${g.id}`);
        }
      }
      if (list.length) console.log(`[STREAK] مفعّل يدويًا على: ${list.join(', ')}`);
    } catch (e) { /* تجاهل */ }
  }
  client.on('messageCreate', (msg) => {
    handlePost(client, msg);
  });

  // مهم: أول بوست في قناة الفروم بيتعمل كـ Thread مش Message عادي
  // لازم نلتقط threadCreate وناخد الرسالة الأولي منه
  client.on('threadCreate', (thread) => {
    try {
      const forumId = getForumId(client._botId, thread.guildId);
      if (!forumId) return;
      if (String(thread.parentId) !== String(forumId)) return;
      thread.fetchStarterMessage().then((m) => {
        if (m) handlePost(client, m);
      }).catch(() => {});
    } catch (e) { /* تجاهل */ }
  });
}

// القناة المستهدفة، من إعداد اللوحة أو env
function getForumId(botId, guildId) {
  try {
    const s = storage.getGuild(botId, guildId);
    if (s.streaks?.forumChannelId) return String(s.streaks.forumChannelId);
  } catch (e) { /* تجاهل */ }
  return process.env.STREAKS_CHANNEL_ID || '';
}

module.exports = { register, handlePost, sendStreakMessage };