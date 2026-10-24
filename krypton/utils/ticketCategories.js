// ═══════════════════════════════════════════════
//  utils/ticketCategories.js - كاتجوريز التيكت التلقائية
//  كل نوع تيكت له كاتجوري مخصوصة تُنشأ تلقائيًا لو ناقصة.
//  المعرّفات بتتخزن في botdata.json تحت ticketCategoryMap
// ═══════════════════════════════════════════════

const storage = require('./storage');

// ─── قراءة خريطة المعرّفات المحفوظة ───
function getCategoryMap() {
  const data = storage.getRaw ? storage.getRaw() : null;
  return (data && data.ticketCategoryMap) || {};
}

// ─── حفظ خريطة المعرّفات ───
function setCategoryMap(map) {
  if (storage.setRaw) storage.setRaw({ ticketCategoryMap: map });
}

// ─── تصفية المعرّفات (الـ ids تكون strings أرقام حقيقية) ───
function isValidId(v) {
  return typeof v === 'string' && /^\d{15,20}$/.test(v);
}

/**
 * التأكد من وجود كاتجوري لكل نوع تيكت (ينشئ الناقص تلقائيًا)
 * @param {import('discord.js').Client} client
 */
async function ensureTicketCategories(client) {
  const config = require('../config');
  const map = getCategoryMap();
  let changed = false;

  for (const cat of config.tickets.categories) {
    // لو في معرّف صحيح متخزن → نستعمله (ممكن يكون user مدخل يدويًا)
    const storedId = map[cat.id] || cat.categoryId;
    if (isValidId(storedId) && client.channels.cache.has(storedId)) {
      continue;
    }

    // نبحث عن كاتجوري موجودة بنفس الاسم (لو المستخدم عاملها بعده)
    const existing = [...client.channels.cache.values()].find(
      (c) => c.type === 4 && c.name.toLowerCase() === (`tickets-${cat.name}`).toLowerCase()
    );

    let categoryId;
    if (existing) {
      categoryId = existing.id;
    } else {
      // إنشاء كاتجوري جديدة
      try {
        const guild = client.guilds.cache.first();
        if (!guild) continue;
        const created = await guild.channels.create({
          name: `🎫 Tickets - ${cat.label}`,
          type: 4, // GuildCategory
        });
        categoryId = created.id;
        console.log(`  ✓ [Tickets] Created category for ${cat.label}: ${created.id}`);
      } catch (err) {
        console.error(`[Tickets] Failed to create category for ${cat.label}:`, err.message);
        continue;
      }
    }

    map[cat.id] = categoryId;
    changed = true;
  }

  if (changed) setCategoryMap(map);
}

module.exports = {
  getCategoryMap,
  setCategoryMap,
  ensureTicketCategories,
  isValidId,
};
