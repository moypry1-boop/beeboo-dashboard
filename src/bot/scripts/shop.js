// ============================================================
// سكربت بوت المتجر — خاص بيك، بعيد تمامًا عن سكربت اللوحة
// بيشتغل من نفس اللوحة بس بيظل أون لاين 24/7
// ============================================================
const fs = require('fs');
const path = require('path');

// شغال على سيرفر المتجر بتاعك (حطه هنا لو عايز، أو من إعدادات اللوحة)
const GUILD_ID = process.env.SHOP_GUILD_ID || '';
const PREFIX = process.env.SHOP_PREFIX || '!';

// المخزون — ملف مستقل عن بيانات اللوحة (أول مرة ينعمل تلقائي)
const DATA_FILE = path.join(__dirname, '..', '..', '..', 'data', 'shop-data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    const base = { products: [], orders: 0, revenue: 0 };
    fs.writeFileSync(DATA_FILE, JSON.stringify(base, null, 2), 'utf8');
    return base;
  }
}
function saveData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
}

const HELP = [
  '🛒 **بوت المتجر**',
  `\`${PREFIX}help\` — الأوامر دي`,
  `\`${PREFIX}stock\` — المنتجات المتاحة`,
  `\`${PREFIX}order <اسم المنتج> [الكمية]\` — تطلب منتج`,
  '',
  '🔥 النظام شغال، بنضيف عليه اللي تحبه.',
].join('\n');

function go(client) {
  client.on('ready', () => {
    console.log(`[SHOP] بوت المتجر "${client.user.tag}" شغال ✅ (سكربت مستقل غر اللوحة)`);
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return;

    // لو حطيت سيرفر المتجر — يشتغل فيه بس
    if (GUILD_ID && msg.guild?.id !== GUILD_ID) return;

    const text = msg.content.trim();

    // الرد في الـ DM أو بأي بريفكس
    if (!msg.channel.isDMBased && !text.startsWith(PREFIX)) return;

    const [cmd, ...args] = text.replace(/^!/, '').trim().split(/\s+/);
    const lower = cmd.toLowerCase();

    if (lower === 'help' || lower === 'مساعدة') {
      return msg.reply(HELP);
    }

    if (lower === 'stock' || lower === 'المنتجات' || lower === 'المتجر') {
      const data = loadData();
      if (!data.products.length) {
        return msg.reply('📦 لسه مفيش منتجات متظاف — "!add <اسم> <السعر>" تضيف منتج.');
      }
      const list = data.products
        .map((p, i) => `**${i + 1}. ${p.name}** — ${p.price} ج.م (متبقى ${p.stock})`)
        .join('\n');
      return msg.reply(`📦 **منتجات المتجر**\n${list}\n\nللطلب اكتب: \`${PREFIX}order <اسم المنتج>\``);
    }

    if (lower === 'order' || lower === 'طلب') {
      const name = args.slice(0, -1).join(' ').trim() || args.join(' ').trim();
      const qty = parseInt(args[args.length - 1], 10) || 1;
      if (!name) return msg.reply('حدد اسم المنتج: `' + PREFIX + 'order <الاسم> [الكمية]`');
      const data = loadData();
      const p = data.products.find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!p) return msg.reply(`❌ مفيش منتج اسمه "${name}" — شوف \`${PREFIX}stock\``);
      if (p.stock < qty) return msg.reply(`❌ الكمية دي مش متاحة دلوقتي (متبقى ${p.stock})`);
      p.stock -= qty;
      data.orders += 1;
      data.revenue += p.price * qty;
      saveData(data);
      console.log(`[SHOP] طلب جديد: ${qty}x ${p.name} بواسطة ${msg.author.tag} — ${p.price * qty} ج.م`);
      return msg.reply(`✅ **تم تسجيل طلبك:** ${qty}x ${p.name} = **${p.price * qty} ج.م**\nأكمل باقي الخطوات في DM قريبًا 🛒`);
    }

    if (lower === 'add' || lower === 'اضافة' || lower === 'إضافة') {
      // الزبون العادي ميقدرش يضيف — في البداية أي حد .. نبقي نحصرها بعدين
      const price = parseInt(args[args.length - 1], 10);
      const name = args.slice(0, -1).join(' ').trim();
      if (!name || !price) return msg.reply('الاستخدام: `' + PREFIX + 'add <اسم المنتج> <السعر>`');
      const data = loadData();
      data.products.push({ name, price, stock: 99 });
      saveData(data);
      return msg.reply(`✅ اتضاف المنتج **${name}** بــ ${price} ج.م`);
    }
  });

  client.on('error', (e) => console.error(`[SHOP]`, e.message));
}

module.exports = go;