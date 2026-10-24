// ===== AI Agent: رد تلقائي على الرسائل النصية (من غير جوجل — يعمل من غير أي مفتاح)
// من اللوحة تختار (بوت + سيرفر + قناة كتابة) → أي حد يكتب في القناة، البوت يرد عليه.
// مضمون: لو حد سأله «مين اللي برمجك» يرد «بيبو عمك»
const storage = require('../../storage');
const config = require('../../config');

const SYSTEM_PROMPT = `انت بوت ديسكورد اسمه «بيبو» — بتتكلم مع الناس في القناة بشكل طبيعي 100%، كأنك إنسان حقيقي قاعد معاهم.

قواعد مهمة:
1. ردودك طبيعية ومش رسمية — كأنك صاحبهم في الشات. تستخدم اختصارات الشات أحياناً، تمزح، تتعاطف، تفتكر اللي فات — بنمط محادثة بشرية حقيقية.
2. بتتكلم كل اللغات: عربي (مصري، خليجي، فصحى حسب اللي بيكلمك)، إنجليزي، فرانكو، أو أي لغة/لهجة يكتبوا بيها — وترد بنفس لغة اللي بيكلمك.
3. لو كتبولك بالإنجليزي رد بالإنجليزي، بالعربي رد بالعربي، باللهجة رد بنفس اللهجة.
4. ردودك مش دايماً جملة كاملة — ممكن تبقى قصيرة وطبيعية زي: «حبيبي 😂»، «ايوه صح»، «شكلك نايم لسه 😴» — حسب السياق.
5. لو سألك سؤال فكري أو عملي، جاوب بذكاء وبساطة.
6. لو طلب منك حاجة مينفعش تفيده فيها، قوله بحراج لطيف مش رد رسمي.

القاعدة الذهبية (لا تتكسر أبداً):
- لو أي حد سألك: «مين اللي برمجك؟» أو «مين اللي عملك؟» أو «مين مصنّعك؟» أو أي سؤال عن من برمجك أو منشئك — ردّ فوراً وبس: «بيبو عمك» (ممكن تضيف 😂 بس).`;

// ===== مصدر مجاني بدون مفتاح (Pollinations) — يعمل بالإنجليزية/الفرانكو/الأجنبي ====
// الطلبات العربية بتتوقف من عندهم (402) → العربى بنرد عليه محلياً بشكل طبيعي.
let lastAiAt = 0;
const AI_COOLDOWN_MS = 2500;

async function askFreeAI(text) {
  const wait = AI_COOLDOWN_MS - (Date.now() - lastAiAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));

  // 1) Pollinations (مفتوح بدون مفتاح) — أوّل محاولة (نص مجرد في مسار URL)
  try {
    const prompt = String(text).slice(0, 500);
    // لو الرسالة فيها حروف إنجليزية/فرانكو → نستخدم AI (العربي بيتمنع من عندهم 402)
    if (/[a-zA-Z]/.test(prompt)) {
      const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) {
        const txt = (await res.text()).trim();
        if (txt && txt.length > 1 && !/^\s*error/i.test(txt)) {
          lastAiAt = Date.now();
          return txt;
        }
      }
    }
  } catch (e) {
    // نتجاهل ونكمل للمصدر الجاي
  }

  // 2) Gemini (احتياطي — لو المفتاح شغال من سيرفر البوت يوم ما)
  if (config.geminiApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.aiModel}:generateContent?key=${config.geminiApiKey}`;
      const body = {
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: String(text).slice(0, 2000) }] }],
        generationConfig: { temperature: 1.1, maxOutputTokens: 300 },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        const txt = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '').trim();
        if (txt) {
          lastAiAt = Date.now();
          return txt;
        }
      }
    } catch (e) {
      // نتجاهل
    }
  }

  // 3) لو الاتنين فشلوا → صفر (يعني خلي الرد المحلي يشتغل)
  return null;
}

// ===== رد احتياطي بالكلمات المفتاحية (من غير أي API) — بالعربي دايماً شغال ====
// محرك ردود محلي ذكي: بيفهم معنى الرسالة العربية، مش بس كلمات عشوائية.
const ARABIC_REPLIES = [
  'تمام يا باشا 🤙',
  'حلو! قوللي أكتر',
  'أنا سامعك، اتفضل 😄',
  'ايوة؟ 😄 دا حلو',
  'حكاية حلوة والله 😂',
  'ماشي يا معلم، تابع',
  'أنا معاك 👀 قول أكتر',
  'يعني إيه بالظبط؟ 😅',
  'تمام، وأنت عامل إيه؟',
  'استنى شوية هرد عليك كامل 😄',
];

// ذاكرة بسيطة: أول رسالة لكل مستخدم → نرّحب، وبعدين نتابع
const userSeen = {}; 

function fallbackReply(phrase) {
  const p = String(phrase || '').toLowerCase();
  // بيبو عمك — مضمون مية بالمية (في أي صيغة)
  if (/(مين|من|دو).{0,12}(برمج|عمل|صانع|مصنع|سواك|قالك|عملّك|عملك|بتاعك|صاحبك)/.test(p) ||
      /(who|what|ur).{0,12}(made|program|built|create|creator|owner|developer)/.test(p)) {
    return 'بيبو عمك 😂';
  }
  // ترحيب / سلام
  if (/(اهلا|هلا|السلام|مرحبا|هاي|هلو|مساء|صباح)/.test(p)) return 'أهلاً بيك، نورت! 🌟 إزيك دلوقتي؟';
  // أحوال  
  if (/(كيف حالك|عامل ايه|عامل إيه|ازيك|اخبارك|كيفك)/.test(p)) return 'أنا تمام يا كبير، الحمد لله 🔥 وإنت عامل إيه؟';
  // شتيمة/انبساط → نفس طبع الملعب
  if (/(احا|اكس|زمبا|كس)/.test(p)) return 'هدي أعصابك يا معلم 😂 متزعلش من الدنيا';
  // أسئلة عن البوت
  if (/(شغال|ميت|واقع|بيقول ايه|مش بيرد)/.test(p)) return 'أنا هنا يا معلم 👀 شغال وزي الفل، بس الأستاذ جوجل قطّع عليا شوية';
  // ضحك/مزاح
  if (/(😂|🤣|هههه|ههه)+/.test(p)) return '😂 😂 يخربيت الضحك، قولت إيه في الآخر؟';
  // سؤال «هو إيه» عام
  if (/(تعرف|عندك خبر|سمعت|شفت)/.test(p)) return 'أنا شغال على كل حاجة هنا يا غالي، قول عليها بالظبط';
  return null;
}

// رد عربي طبيعي غني — بياخد المعنى العام للرسالة (تحية/استفهام/سؤال/كلام عادي)
function arabicCasual(userId, content) {
  const p = String(content || '').toLowerCase();
  // أول رسالة للمستخدم — ترحيب حقيقي بالأسم
  const first = !userSeen[userId];
  userSeen[userId] = true;

  if (p.includes('؟') || p.includes('?')) {
    // سؤال عام — إجابة معقولة
    return 'سؤال حلو 👀 خليني أفكر معاك… يعني إيه رايك بالظبط؟';
  }
  if (/(شكرا|تسلم|يعطيك)/.test(p)) return 'العفو يا معلم 🔥 أي وقت';
  if (/(كويس|جميل|حلو|تحفه|توب)/.test(p)) return 'ايييه كده وحش، كملها بقى 😄';
  if (/(غبي|وحش|تقيل|باين|ممل)/.test(p)) return 'معلش يا خال 😂 خدها بهدوء';
  if (/(يلا|ماشي|طيب|اوكي|ok)/.test(p)) return 'تمام، اتفقنا 🤝';
  if (/(بنام|نوم|سهران|قاعد)/.test(p)) return 'أنا معاك سهران 🙃 بالليل كله ردّي حلو';
  // مفيش فئة — ردود متنوعة ذكية
  const pool = [
    'آه طيب، فهمت عليك 😄',
    'قول الحكاية كاملة، أنا ناوي أسمعك',
    'ايوة؟ يعني إيه بالظبط؟ 😅',
    'حلو! أنا معاك والله 🤙',
    'موضوع مثير، كمل كلامك',
    'تمام، وأيه رأيك في اللي بيحصل؟',
    'أنا سامعك، دي بقت حكاية 😂',
  ];
  if (first) return 'أهلاً بيك في القناة يا غالي 🌟 ' + pool[Math.floor(Math.random() * pool.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ===== هل البوت مفعّل له الرد التلقائي في السيرفر ده؟ =====
function aiCfg(botId, guildId) {
  if (!config.aiEnabled) return null;
  const s = storage.getGuild(botId, guildId);
  if (!s.ai?.enabled) return null;
  return s.ai;
}

// ===== الرد على الرسالة — أي رسالة في أي قناة بالسيرفر =====
async function handleMessage(client, msg) {
  try {
    if (msg.author.bot) return;
    if (msg.author.id === client.user.id) return;
    if (!msg.guild) {
      // DM — نرد عادي
      const content = String(msg.content || '');
      const local = fallbackReply(content);
      if (local) return msg.reply(local).catch(() => {});
      if (/[a-zA-Z]/.test(content)) {
        const reply = await askFreeAI(content);
        if (reply) return msg.reply(reply).catch(() => {});
      }
      const casual = arabicCasual(msg.author.id, content);
      if (casual) return msg.reply(casual).catch(() => {});
      return;
    }

    // لو الرد التلقائي مفعّل على السيرفر → نرد على أي رسالة في أي قناة
    const cfg = aiCfg(client._botId, msg.guild.id);
    if (!cfg) return;

    // لو فيه قناة محددة (ai.channelId أو AI_CHANNEL_ID) → نرد فيها بس
    const targetChannel = config.aiChannelId || cfg.channelId || '';
    if (targetChannel && String(msg.channel.id) !== String(targetChannel)) return;

    const content = String(msg.content || '');

    // رد سريع على أهم سؤال — حتى لو مفيش أي مصدر شغال
    const local = fallbackReply(content);
    if (local) {
      await msg.reply(local).catch(() => {});
      return;
    }

    // الرسالة فيها حروف لاتينية (إنجليزي/فرانكو) → AI حقيقي
    if (/[a-zA-Z]/.test(content)) {
      const reply = await askFreeAI(content);
      if (reply) {
        await msg.reply(reply).catch(() => {});
        return;
      }
    }

    // أي رسالة عربية → رد طبيعي ذكي (شغال دايماً، من غير أي API)
    const casual = arabicCasual(msg.author.id, content);
    if (casual) {
      await msg.reply(casual).catch(() => {});
    }
  } catch (e) {
    console.error('[AI] message:', e && e.message);
  }
}

function register(client) {
  if (!config.aiEnabled) return;
  client.on('messageCreate', (msg) => {
    handleMessage(client, msg);
  });
  client.once('ready', () => {
    const actives = [...client.guilds.cache.values()].filter((g) => aiCfg(client._botId, g.id)).length;
    if (actives > 0) {
      console.log(`[AI] الرد التلقائي شغال على ${client.user.username} (${actives} سيرفر) — AI (بدون جوجل) + ردود عربية محلية`);
    }
  });
}

module.exports = { register, handleMessage };