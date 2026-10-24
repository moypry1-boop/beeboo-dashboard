// ═══════════════════════════════════════════════
//  KRYPTON Store Bot - Configuration
//  غيّر القيم دي حسب السيرفر بتاعك
// ═══════════════════════════════════════════════

module.exports = {
  // ─── توكن البوت ───
  token: process.env.KRYPTON_BOT_TOKEN || process.env.BOT_TOKEN || '',
  clientId: '1524530489136906300',

  // ─── الآيديهات ───
  ids: {
    guild: '1381695125310275656',

    // المالك
    ownerId: '1261697605335908455',
    ownerRoleId: '1543840560689840148', // رول المالك (نفس الأدمن دلوقتي)

    // الرومات
    verifyChannel: '1543840841951346768',
    ticketChannel: '1543840894510440500',

    // الرولز
    verifiedRole: '1543840579782320238',
    staffRole: '1543840562938126439',
    adminRole: '1543840560689840148',
    mutedRole: 'MUTED_ROLE_ID_HERE',
    // رولات الستاتس (متغيّرة من الانترفيو الغول — للتأمين)
    girlRoleId: '1543915764837261343',
    underageRoleId: '1543915766477488178',

    // الكاتجوري بتاعت التكت
    ticketCategory: '1543840605942054953',

    // رومات اللوجات (مش ويبهوكات - أوتوماتيك)
    logChannel: '1543841041231122452',
    ticketLogChannel: '1543841041231122452',
    securityLogChannel: '1543841041231122452',

    // ─── رومات الأنظمة الجديدة ───
    rolesChannel: '1543840859605442590',      // 🎭 roles
    pollsChannel: '1543840855918641175',      // 📊 polls
    reviewChannel: '1543841037896777850',     // 📊 review
    suggestionsChannel: '1543881245308624987',                  // 📨 suggestions (بيتظبط أوتوماتيك)
  },

  // ─── Reaction Roles ───
  roles: {
    panels: [
      {
        title: '🎭 اختار رولاتك',
        description: 'اختار الرولات اللي تعبر عنك من القوائم تحت.\nعايز رول أكتر؟ اضغط عليه تاني وهيتشال.',
        options: [
          { roleId: '1543840569690693722',   label: '💻 Developer',      description: 'مطور' },
          { roleId: '1543840570911359037',   label: '🎨 Designer',       description: 'مصمم' },
          { roleId: '1543840568306835467',   label: '🧊 3D Developer',   description: 'مطور ثري دي' },
          { roleId: '1543840573163704430',   label: '🎥 Animator',       description: 'موشن' },
          { roleId: '1543840571746029610',   label: '⚙️ Configurator',  description: 'كونفيجورتر' },
          { roleId: '1543840567241220107',   label: '📂 Leaker',         description: 'ليكر' },
          { roleId: '1543840574442967060',   label: '🐞 Bug Tester',     description: 'تجربة الأكواد' },
          { roleId: '1543840577588690954',   label: '🚀 Booster',        description: 'بوستر' },
        ],
      },
    ],
  },

  // ─── Anti-Spam / Anti-Raid ───
  antiSpam: {
    // رسايل أكتر من كده في ثواني = تهديد
    warnThreshold: 5,
    warnWindow: 5000,
    // رسايل أكتر من كده = مكت تلقائي
    muteThreshold: 8,
    muteWindow: 10000,
    muteDuration: 600000, // 10 دقايق
    // أعضاء جدد أكتر من كده في 30 ثانية = raid
    raidThreshold: 5,
    raidWindow: 30000,
    // كلمات ممنوعة (هيتحذفوا ويسجلوا)
    badWords: [
      'scam', 'scammer', 'ngn', 'احتيال', 'نصب',
      'free nitro', 'nitro giveaway', 'discord.gift',
      'hack', 'injector', 'آيتوز', 'crypto giveaway',
    ],
    // منع اللينكات للأعضاء غير الموثقين
    blockLinksForUnverified: true,
  },

  // ─── Leveling ───
  leveling: {
    enabled: true,
    minXp: 15,
    maxXp: 25,
    // مدة الـ cooldown بين كل رسالة واللي بعدها بالمللي ثانية (منع الفارم)
    xpCooldown: 60000,
    // رولات ليفلات معينة: [ [level, roleId], ... ]
    levelRewards: [],
    // فولدر/متصدر الرسايل في روم الليفل أب (لو فاضي => DM)
    levelUpChannel: '',
  },

  // ─── Giveaways ───
  giveaways: {
    defaultChannel: '1543840849773731941', // 📢 announcements
    requireRole: '', // رول إجباري للمشاركة (اختياري)
    maxDuration: 7 * 24 * 60 * 60 * 1000, // أسبوع كحد أقصى
    pingOnEnd: true,
  },

  // ─── المراجعات ───
  reviews: {
    cooldown: 60 * 60 * 1000, // مراجعة واحدة لكل ساعة
  },

  // ─── Temp Voice ───
  tempVoice: {
    enabled: true,
    // البوت بينشئ الكاتجوري والروم أوتوماتيك بسكريبت الإعداد
    categoryId: '1543881246898262087',
    createChannelId: '1543881247770673177',
    voiceCategory: '🔊 VOICE',
    createChannelName: '➕ Join To Create',
    channelNameFormat: '🔊 {username}',
    autoDeleteMs: 30000,
  },

  // ─── الاقتراحات ───
  suggestions: {
    requireStaffToApprove: true,
  },

  // ─── إعدادات التكت ───
  tickets: {
    categories: [
      // categoryId = معرف الكاتجوري اللي يفتح فيها التيكت (انسخه من Discord بالـ right-click → Copy Channel ID بعد تفعيل Developer Mode).
      // لو تركته null → يفتح في الكاتجوري الأساسية (ids.ticketCategory).
      { id: 'bot-script', emoji: '🤖', name: 'bot-script', label: 'Bot Script', categoryId: null },
      { id: 'gain-followers', emoji: '🌍', name: 'gain-followers', label: 'Gain Followers', categoryId: null },
      { id: 'dump-fivem', emoji: '📁', name: 'dump-fivem', label: 'Dump FiveM', categoryId: null },
      { id: 'onesync', emoji: '📀', name: 'onesync', label: 'OneSync', categoryId: null },
      { id: 'partners', emoji: '🤝', name: 'partners', label: 'Partners', categoryId: null },
      { id: 'admin-application', emoji: '📋', name: 'admin-application', label: 'تقديم إداره', categoryId: null },
      { id: 'support', emoji: '🛠️', name: 'support', label: 'حل المشاكل', categoryId: null },
      { id: 'inquiry', emoji: '❓', name: 'inquiry', label: 'استفسار', categoryId: null },
    ],
    maxTicketsPerUser: 3,
  },

  // ─── إعدادات الحماية ───
  protection: {
    // عدد الرولات اللي ممكن يتضافوا في 10 ثواني
    maxRoleCreates: 5,
    // عدد الرومات اللي ممكن تتنشأ في 10 ثواني
    maxChannelCreates: 5,
    // عدد البيرميشنز اللي ممكن تتعدّل في 10 ثواني
    maxPermissionUpdates: 5,
    // عدد الأعضاء اللي ممكن يتعملهم كيك في 10 ثواني
    maxKicks: 3,
    // عدد الأعضاء اللي ممكن يتعملهم بان في 10 ثواني
    maxBans: 3,
    // مدة الـ cooldown بالمللي ثانية
    cooldownDuration: 10000,
  },

  // ─── إعدادات الـ Verify القوي ───
  verify: {
    // هل نتحقق من سن الحساب قبل التوثيق؟
    checkAccountAge: true,
    // أقل عمر مسموح للحساب (بالأيام) — حساب أصغر من ده يتطلب موافقة الإدارة
    minAccountAgeDays: 7,
    // هل نطلب قبول القوانين قبل التوثيق؟ (عبر زر welcome_rules)
    requireRules: true,
    // منع الضغط المتكرر: عدد المحاولات والسرعة
    maxAttempts: 5,
    attemptWindowMs: 60000, // 60 ثانية
    // هل نحول الحسابات المشبوهة لموافقة يدوية بدل التوثيق الفوري؟
    manualApproval: true,
    // روم تنبيه الموافقات اليدوية (لو فاضي يستخدم الـ log channel)
    approvalChannel: '1543841041231122452',
  },

  // ─── أرشفة التيكتات ───
  transcripts: {
    archiveChannel: '1543841041231122452', // روم الأرشفة (logs افتراضيًا)
    maxMessages: 500,
  },

  // ─── التحذيرات ───
  warnings: {
    maxWarningsBeforeMute: 3,
    muteDuration: 10 * 60 * 1000, // 10 دقايق
  },

  // ─── المخزون ───
  stock: {
    alertChannel: '1543841041231122452', // تنبيهات نفاذ المخزون
  },

  // ─── كشف روابط سيرفرات تانية ───
  invitations: {
    enabled: true,
    blockForEveryone: true,
    allowlist: ['krypton'], // كودات الدعوات المسموحة (سيرفرك)
  },

  // ─── حماية الروابط المشبوهة (فيشنج/IP grabber/روابط غريبة) ───
  linkProtection: {
    enabled: true,
    // مدة المكت (timeout) بالمللي ثانية لو بعت رابط مشبوه (0 = من غير مكت)
    timeout: 3600000, // ساعة
  },

  // ─── Auto-Publish ───
  autoPublish: {
    enabled: true,
    channels: ['1543840849773731941'], // روم الإعلانات
  },

  // ─── الحسابات الجديدة ───
  newcomer: {
    enabled: true,
    minAccountAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 أيام
    roleId: '1543898381670416444', // بتتعمل أوتوماتيك بسكريبت الإعداد
  },
  // قيمة فريدة للموديشن الداخلي (بيتظبط تلقائي)
  newcomerRoleId: '1543898381670416444',

  // ─── لعبة العد ───
  counting: {
    enabled: false, // ⛔ اللعبة موقوفة
    channelId: '', // بتتعمل أوتوماتيك
    maxSameUserConsecutive: 1,
  },
  // قيمة فريدة للروم الداخلي (بيتظبط تلقائي)
  countingChannelId: '',

  // ─── Auto-Responder / FAQ ───
  autoResponder: {
    enabled: true,
    rules: [
      {
        triggers: ['سعر', 'الاسعار', 'شراء'],
        response: '🛒 لمعرفة الأسعار والشراء افتح تيكت من روم 🎫 واختار القسم المناسب!',
      },
      {
        triggers: ['تكت', 'ticket', 'مساعدة'],
        response: '🎫 محتاج مساعدة؟ افتح تيكت من روم 🎫┃tickets.',
      },
      {
        triggers: ['verify', 'توثيق'],
        response: '🔐 روح روم ✅┃verify واضغط زر Verify.',
      },
    ],
  },

  // ─── قوانين البطاقة الترحيبية ───
  welcomeCard: {
    welcomeChannel: '1543840846053515315', // 👋🏻 welcome
    rulesText:
      '📜 **قوانين السيرفر:**\n' +
      '1. احترم الجميع، مفيش سبام أو شتيمة.\n' +
      '2. ممنوع النصب أو الاحتيال في أي تعامل.\n' +
      '3. ممنوع نشر روابط سيرفرات تانية.\n' +
      '4. اتبع تعليمات الإدارة.\n' +
      '5. الضغط على زر قبول القوانين معناه التزامك بيها.',
  },

  // ─── رسالة الويلكم (الـ Embed) — قابلة للتعديل بالكامل ───
  welcomeEmbed: {
    // الروم اللي بتتبعت فيه رسالة الويلكم
    channelId: '1543840846053515315',
    // روم الفيريفيكيشن (بيظهر كمنشن في الوصف وكزر رابط للتحقق)
    verifyChannelId: '1543840841951346768',
    // العنوان (بخطوط يونيكود عريضة/مائلة)
    title: '𝐖𝐞𝐥𝐜𝐨𝐦𝐞 𝐓𝐨 𝙺𝚁𝚈𝙿𝚃𝙾𝙽',
    // لون الـ Embed (هيكس)
    color: 0x29b9f2,
    // صورة الـ Banner الكبيرة داخل الـ Embed
    bannerURL: 'https://cdn.discordapp.com/attachments/1313902041256427561/1544173052512960612/ChatGPT_Image_1_2026_05_32_08_.png?ex=6a978ab9&is=6a963939&hm=4081a48dc2a5cf7a6396ed3c5f2798781cb9f99da81c6c519ca92e5a3ba4fe30&',
    // الـ Thumbnail أعلى يمين الرسالة (جنب العنوان)
    thumbnailURL: '', // اكتب رابط صورة هنا
    // النصوص (تغيّرهم من هنا)
    texts: {
      // سطر "ممنوع نسيان قوانين" مع الإيموجي والسهم
      rulesLine: {
        text: 'Don\'t Forget To Read The Rules',
        emoji: '⚠️',
        arrow: '👇',
      },
      // Text: No Access (Badge)
      noAccess: '🚫 **No Access**',
      // جملة الاستمتاع
      enjoy: 'Hope To Enjoy With Us 💝',
    },
    // الفوتر (أسفل الرسالة)
    footer: {
      // بيضيف اسم السيرفر أوتوماتيك
      showServerName: true,
      // كلمة الـ Season (مثلاً: "Season 1")
      season: 'Season 1',
      // بيضيف عدد الأعضاء الحالي أوتوماتيك
      showMemberCount: true,
    },
    // هل نعرض زرار "أوافق على القوانين"؟
    showRulesButton: true,
  },

  // ─── سجل حضور الستاف ───
  staffAttendance: {
    staffRoleId: '1543840562938126439', // رول الستاف
    logChannelId: '1543841041231122452', // روم اللوجات
    weeklyReportChannelId: '1543841041231122452',
    workdayStart: '09:00',
    workdayEnd: '23:00',
  },

  // ─── نظام البوستات ───
  posts: {
    enabled: true,
    postsChannel: '1543840901942747156', // 📜 scripts - روم البوستات الرئيسي
    postsCategoryId: '1543915768624840717', // كاتجوري لرومات البا استرز (بيتعمل بسكريبت)
    maxActivePosts: 3,
  },

  // ─── Gmail ───
  gmail: {
    user: 'moypry1@gmail.com',
    appPassword: 'luff raqh zisz yyqy',
    fromName: 'KRYPTON',
    replyTo: 'moypry1@gmail.com',
    // توقيع البريد
    signature:
      '<br><br>—<br><b>KRYPTON Store</b><br>' +
      'شكراً لتعاملك معنا!',
  },

  // ─── نظام الـ Downloads (تحويل المحتوى من الشات لملف منسّق) ───
  downloads: {
    // الروم اللي بيستقبل المحتوى ويحوّله لملف (فاضي = يتعرف تلقائي أو يُنشأ)
    channelId: '',
    // هل ننشئ روم downloads تلقائيًا لو مش موجود؟
    autoCreateChannel: false,
    // نوع الافتراضي لما منحددش: 'html' | 'txt' | 'json'
    defaultFormat: 'html',
    // روم اللوجات للتسجيل
    logChannelId: '1543841041231122452',
  },

  // ─── Anti-Nuke متقدم ───
  antinuke: {
    enabled: true,
    banChannelCreate: 3,   // إنشاء رومات خلال دقيقة
    banChannelDelete: 3,   // حذف رومات خلال دقيقة
    banRoleCreate: 3,      // إنشاء رولات خلال دقيقة
    banRoleDelete: 3,      // حذف رولات خلال دقيقة
    banBanThread: 3,       // بان بمعظم خلال دقيقة
    banKickThread: 3,      // كيك بمعظم خلال دقيقة
    punishment: 'ban',     // ban | kick | strip
    exemptRoles: [],       // رولات معفية
    // Rollback - إعادة إنشاء المحذوف تلقائيًا
    rollback: {
      channels: true,   // يعيد إنشاء الرومات المحذوفة
      roles: true,      // يعيد إنشاء الرولات المحذوفة
    },
    logChannelId: '1543841041231122452',
  },
};
