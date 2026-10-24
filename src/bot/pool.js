// مدير البوتات: تشغيل/إضافة/حذف حتى 100 بوت في نفس العملية
const { createClient } = require('./client');
const storage = require('../storage');
const fs = require('fs');
const path = require('path');

const MAX_BOTS = 100;

class BotPool {
  constructor() {
    this.clients = new Map();  // botId -> Client
    this.errors = new Map();   // botId -> رسالة خطأ
    this.meta = new Map();     // botId -> {username, avatar, tag}
  }

  async launch(entry) {
    const client = createClient(entry.token, entry.id, entry);
    await client.login(entry.token);
    this.clients.set(entry.id, client);
    this.errors.delete(entry.id);
    this.meta.set(entry.id, {
      username: client.user.username,
      tag: client.user.tag,
      avatar: client.user.displayAvatarURL({ size: 128 }),
    });
    return client;
  }

  async startAll() {
    const bots = storage.getBots();
    for (const b of bots) {
      try {
        await this.launch(b);
        console.log(`[BOT] ${b.label} شغال ✅`);
      } catch (e) {
        this.errors.set(b.id, e.message);
        console.warn(`[BOT] إعادة محاولة "${b.label}"... (${e.message})`);
        await new Promise((r) => setTimeout(r, 2500));
        try {
          await this.launch(b);
          console.log(`[BOT] ${b.label} شغال ✅ (بعد إعادة المحاولة)`);
        } catch (e2) {
          this.errors.set(b.id, e2.message);
          console.error(`[BOT] فشل تشغيل "${b.label}": ${e2.message}`);
        }
      }
      // مهلة 2000ms بين كل بوت لتفادي تضييق Discord Gateway Rate-Limit
      await new Promise((r) => setTimeout(r, 2000));
    }
    console.log(`[POOL] اتشغل ${this.clients.size}/${bots.length} بوت`);
  }

  // إضافة بوت جديد (بتحقق من التوكن الأول) — hidden = مش بيظهر في اللوحة غير للمالك
  // script = اسم سكربت خاص للبوت (مقابل الميزات العادية) — مش محتاج للبوتات العادية
  async add(label, token, hidden = false, script = '') {
    if (!token || typeof token !== 'string') throw new Error('اكتب التوكن');
    if (storage.getBots().length >= MAX_BOTS) throw new Error(`الحد الأقصى ${MAX_BOTS} بوت`);

    let me;
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${token.trim()}` },
      });
      if (!res.ok) throw new Error('invalid');
      me = await res.json();
    } catch {
      throw new Error('التوكن غير صالح — انسخه تاني من تبويب Bot في الديفلوبر بورتال');
    }

    if (storage.getBot(me.id)) throw new Error('البوت ده متضاف قبل كده');

    const selScript = script && fs.existsSync(path.join(__dirname, 'scripts', script + '.js')) ? script : '';

    const entry = { id: me.id, label: (label || '').trim() || me.username, token: token.trim(), hidden: !!hidden, script: selScript, addedAt: Date.now() };
    try {
      storage.saveBot(entry);          // نحفظه الأول عشان لو الريستارت حصل يرجع يشتغل
      await this.launch(entry);
    } catch (e) {
      this.errors.set(entry.id, e.message);
      if (String(e.message).includes('disallowed intents')) {
        throw new Error('فعّل Server Members Intent و Message Content Intent من تبويب Bot في الديفلوبر بورتال وبعدين جرّب تاني');
      }
      throw new Error('فشل تشغيل البوت: ' + e.message);
    }
    return { id: entry.id, label: entry.label, ...this.meta.get(entry.id) };
  }

  async remove(id) {
    const c = this.clients.get(id);
    if (c) await c.destroy().catch(() => {});
    this.clients.delete(id);
    this.meta.delete(id);
    this.errors.delete(id);
    storage.deleteBot(id);
  }

  get(id) { return this.clients.get(id); }
  isOnline(id) { return this.clients.has(id); }
  errorOf(id) { return this.errors.get(id) || null; }
}

// نسخة واحدة (singleton) للبرنامج كله
module.exports = new BotPool();
