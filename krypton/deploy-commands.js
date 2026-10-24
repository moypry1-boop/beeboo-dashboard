// ═══════════════════════════════════════════════
//  Deploy Commands - نشر أوامر السلاب
//  شغّل: node deploy-commands.js
// ═══════════════════════════════════════════════

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('./config');

const commands = [
  // ─── أوامر الإدارة ───
  new SlashCommandBuilder()
    .setName('send-verify')
    .setDescription('يرسل رسالة الـ Verify في الروم المخصص')
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('send-ticket')
    .setDescription('يرسل رسالة فتح التيكت')
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('send-roles')
    .setDescription('يرسل لوحة اختيار الرولات')
    .setDefaultMemberPermissions(0x8),

  // ─── الاقتراعات ───
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('يعمل اقتراع بالزرارات')
    .addStringOption(o => o.setName('question').setDescription('السؤال').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('الخيارات مفصولة بكومة (,)').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('الروم (اختياري)')),

  // ─── الاقتراحات ───
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('يقدم اقتراح للسيرفر')
    .addStringOption(o => o.setName('suggestion').setDescription('الاقتراح').setRequired(true)),

  // ─── المستويات ───
  new SlashCommandBuilder()
    .setName('level')
    .setDescription('يعرض مستوى العضو')
    .addUserOption(o => o.setName('user').setDescription('العضو (اختياري)')),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('متصدرين المستويات'),

  // ─── الجيف أواي ───
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('يعمل جيف أواي')
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('المدة (10s, 5m, 2h, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('عدد الفايزين'))
    .addChannelOption(o => o.setName('channel').setDescription('الروم (اختياري)'))
    .setDefaultMemberPermissions(0x8),

  // ─── المراجعات ───
  new SlashCommandBuilder()
    .setName('review')
    .setDescription('يكتب مراجعة على المتجر')
    .addIntegerOption(o => o.setName('rating').setDescription('التقييم من 1 لـ 5').setMinValue(1).setMaxValue(5).setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('المراجعة').setMaxLength(1000).setRequired(true)),

  // ─── البث ───
  new SlashCommandBuilder()
    .setName('broadcast')
    .setDescription('يبعت إعلان للأعضاء أو الرومات')
    .addStringOption(o => o.setName('message').setDescription('نص الإعلان').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('يبعت DM لكل الأعضاء اللي عندهم الرول ده'))
    .addChannelOption(o => o.setName('channel').setDescription('الروم اللي يتبعت فيه'))
    .setDefaultMemberPermissions(0x8),

  // ─── التحذيرات ───
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('يحذر عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(true))
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('warns')
    .setDescription('سجل تحذيرات العضو')
    .addUserOption(o => o.setName('user').setDescription('العضو'))
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('clearwarns')
    .setDescription('يمسح تحذيرات عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .setDefaultMemberPermissions(0x8),

  // ─── المخزون ───
  new SlashCommandBuilder()
    .setName('addstock')
    .setDescription('يضيف مخزون لمنتج')
    .addStringOption(o => o.setName('product').setDescription('اسم المنتج').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('الكمية').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('السعر'))
    .addStringOption(o => o.setName('note').setDescription('ملاحظة'))
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('removestock')
    .setDescription('يخصم مخزون من منتج')
    .addStringOption(o => o.setName('product').setDescription('اسم المنتج').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('الكمية').setRequired(true))
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('stock')
    .setDescription('يعرض المخزون'),

  // ─── تذكير وأعياد ───
  new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('يحدد تذكير')
    .addStringOption(o => o.setName('time').setDescription('المدة (30s, 10m, 1h)').setRequired(true))
    .addStringOption(o => o.setName('text').setDescription('نص التذكير').setRequired(true)),

  new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('يسجل عيد الميلاد')
    .addStringOption(o => o.setName('date').setDescription('التاريخ بصيغة DD/MM').setRequired(true)),

  // ─── إحصائيات ───
  new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('إحصائيات نشاط السيرفر')
    .setDefaultMemberPermissions(0x8),

  // ─── القفل ───
  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('يقفل أو يفتح السيرفر')
    .addStringOption(o => o.setName('action').setDescription('on / off').setRequired(true).addChoices(
      { name: 'ON', value: 'on' }, { name: 'OFF', value: 'off' }))
    .setDefaultMemberPermissions(0x8),

  // ─── أوامر التيكت ───
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('أوامر التيكت')
    .addSubcommand(sub => sub.setName('close').setDescription('يقفل التيكت'))
    .addSubcommand(sub => sub.setName('add').setDescription('يضيف عضو للتيكت').addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('يشيل عضو من التيكت').addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)))
    .addSubcommand(sub => sub.setName('rename').setDescription('يغير اسم التيكت').addStringOption(o => o.setName('name').setDescription('الاسم الجديد').setRequired(true))),

  // ─── أوامر المودريشن ───
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('يعمل كيك لعضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(0x2),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('يعمل بان لعضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(0x4),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('يشيل البان عن عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .setDefaultMemberPermissions(0x4),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('يعمل مكت لعضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('المدة بالدقائق').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(0x2),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('يشيل المكت عن عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .setDefaultMemberPermissions(0x2),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('يمسح رسايل')
    .addIntegerOption(o => o.setName('amount').setDescription('عدد الرسايل').setRequired(true))
    .setDefaultMemberPermissions(0x2),

  // ─── أوامر عامة ───
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('يعرض أوامر البوت'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('إحصائيات السيرفر'),

  // ─── أنظمة جديدة ───
  new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('تسجيل حضور الستاف'),

  new SlashCommandBuilder()
    .setName('checkout')
    .setDescription('تسجيل انصراف الستاف'),

  new SlashCommandBuilder()
    .setName('postsetup')
    .setDescription('إنشاء روم بوستات خاص بيك')
    .setDefaultMemberPermissions(0x8),

  new SlashCommandBuilder()
    .setName('post')
    .setDescription('نشر بوستك في روم البوستات العام'),

  new SlashCommandBuilder()
    .setName('bill')
    .setDescription('إرسال فاتورة أنيقة للعميل عبر الإيميل')
    .addStringOption(o => o.setName('email').setDescription('إيميل العميل').setRequired(true))
    .addStringOption(o => o.setName('items').setDescription('المنتجات: VIP 25, Nitro 9.99').setRequired(true))
    .addStringOption(o => o.setName('customer').setDescription('اسم العميل (اختياري)'))
    .addStringOption(o => o.setName('total').setDescription('الإجمالي لو محسبش تلقائي (اختياري)'))
    .addStringOption(o => o.setName('note').setDescription('ملاحظة (اختياري)'))
    .addStringOption(o => o.setName('invoice').setDescription('رقم الفاتورة (اختياري)'))
    .addStringOption(o => o.setName('currency').setDescription('العملة: $ , EGP , SAR ... (افتراضي $)'))
    .addStringOption(o => o.setName('lang').setDescription('اللغة: ar أو en (افتراضي عربي)'))
    .setDefaultMemberPermissions(0x8),

  // ─── النسخ الاحتياطي ───
  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('نسخة احتياطية للسيرفر (إنشاء/استرجاع/قائمة)')
    .addStringOption(o => o.setName('action').setDescription('create / restore / list').addChoices(
      { name: 'Create', value: 'create' },
      { name: 'Restore (الاسترجاع)', value: 'restore' },
      { name: 'List', value: 'list' }))
    .setDefaultMemberPermissions(0x8),

  // ─── تعقيم حساب مخترق/مشبوه ───
  new SlashCommandBuilder()
    .setName('strip')
    .setDescription('تعقيم حساب مخترق/مشبوه (شيل رولات + مسح رسائل + بان)')
    .addUserOption(o => o.setName('user').setDescription('العضو المخترق/المشبوه').setRequired(true))
    .addStringOption(o => o.setName('action').setDescription('العقوبة').addChoices(
      { name: 'Strip only (شيل الرولات والرسائل)', value: 'strip' },
      { name: 'Ban (حظر)', value: 'ban' },
      { name: 'Kick (طرد)', value: 'kick' }))
    .setDefaultMemberPermissions(0x8),

  // ─── إنزال ملف منسّق ───
  new SlashCommandBuilder()
    .setName('download')
    .setDescription('إنزال محتوى/سكريبت كملف منسّق في روم')
    .addStringOption(o => o.setName('title').setDescription('اسم المنتج/السكريبت').setRequired(true))
    .addStringOption(o => o.setName('content').setDescription('المحتوى/الكود (اكتبه هنا بالتفصيل)').setRequired(true))
    .addStringOption(o => o.setName('desc').setDescription('الوصف (اختياري)'))
    .addStringOption(o => o.setName('format').setDescription('نوع الملف').addChoices(
      { name: 'HTML (بطاقة أنيقة)', value: 'html' },
      { name: 'JSON (بيانات)', value: 'json' },
      { name: 'TXT (نص عادي)', value: 'txt' }))
    .addChannelOption(o => o.setName('channel').setDescription('الروم اللي ينزل فيه (اختياري - الافتراضي الروم الحالي)')),
];

const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
  try {
    console.log('🔥 Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.ids.guild),
      { body: commands }
    );

    console.log('✅ Commands registered successfully!');
  } catch (err) {
    console.error('❌ Failed to register commands:', err.message);
  }
})();