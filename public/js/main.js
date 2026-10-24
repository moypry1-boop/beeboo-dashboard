/* Red Bull — جافاسكريبت اللوحة */
const SERVER_PAGE = document.querySelector('.server-page');
const BOT_ID = SERVER_PAGE?.dataset.bot;
const GUILD_ID = SERVER_PAGE?.dataset.guild;

// حفظ آخر بوت + سيرفر اتفتح في localStorage للوحة السرية
if (BOT_ID && GUILD_ID) {
  localStorage.setItem('secretBot', BOT_ID);
  localStorage.setItem('secretGuild', GUILD_ID);
}

// ===== التوست =====
function toast(msg, ok = true) {
  const wrap = document.getElementById('toast-wrap') || document.body;
  const el = document.createElement('div');
  el.className = `toast ${ok ? 'ok' : 'err'}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حصل خطأ');
  return data;
}

const api = (p) => `/api/server/${BOT_ID}/${GUILD_ID}/${p}`;

// ===== التابات =====
document.querySelectorAll('#tabs .tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#tabs .tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
  });
});

// ===== حفظ الفورمات (صفحة السيرفر) =====
if (SERVER_PAGE) {
  document.querySelectorAll('form.api').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      form.querySelectorAll('input[type=checkbox]').forEach((c) => {
        if (c.name.startsWith('events.')) {
          body.events = body.events || {};
          body.events[c.dataset.ev] = c.checked;
        } else {
          body[c.name] = c.checked;
        }
      });
      form.querySelectorAll('input[type=text], input[type=number], select, textarea').forEach((i) => {
        if (i.name) body[i.name] = i.value;
      });
      const feature = form.dataset.feature;
      const section = feature ? 'protection' : form.dataset.section;
      try {
        await post(api(section), feature ? { ...body, feature } : body);
        toast('✅ تم الحفظ بنجاح');
      } catch (err) {
        toast('❌ ' + err.message, false);
      }
    });
  });

  // ===== أوامر مباشرة =====
  const actType = document.getElementById('act-type');
  const actMinutes = document.getElementById('act-minutes');
  actType?.addEventListener('change', () => {
    if (actMinutes) actMinutes.style.display = actType.value === 'timeout' ? '' : 'none';
  });

  const doActionBtn = document.getElementById('do-action');
  doActionBtn?.addEventListener('click', async () => {
    const userId = document.getElementById('act-user').value.trim();
    const type = document.getElementById('act-type').value;
    const minutes = document.getElementById('act-minutes')?.value || 10;
    const reason = document.getElementById('act-reason').value.trim() || 'بدون سبب';
    if (!userId) return toast('❌ اكتب آي دي العضو', false);

    const names = { timeout: 'إسكات', untimeout: 'فك الإسكات', kick: 'طرد', ban: 'حظر', unban: 'فك حظر', warn: 'تحذير' };
    if (!confirm(`متأكد من تنفيذ "${names[type]}" على ${userId}؟`)) return;

    doActionBtn.disabled = true;
    try {
      await post(api('action'), { type, userId, minutes, reason });
      toast(`✅ تم تنفيذ (${names[type]})`);
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast('❌ ' + err.message, false);
    } finally {
      doActionBtn.disabled = false;
    }
  });

  // ===== مسح تحذيرات =====
  document.querySelectorAll('.warn-clear').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('مسح كل تحذيرات العضو ده؟')) return;
      try {
        await post(api('warnings/clear'), { userId: btn.dataset.user });
        btn.closest('tr').remove();
        toast('✅ اتمسحت التحذيرات');
      } catch (err) { toast('❌ ' + err.message, false); }
    });
  });

  // ===== نشر لوحة التذاكر =====
  const postPanel = document.getElementById('post-panel');
  postPanel?.addEventListener('click', async () => {
    try {
      await post(api('tickets/post-panel'), {});
      toast('✅ اتنشرت لوحة التذاكر 🎫');
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  // ===== الأوامر المخصصة =====
  const ccForm = document.getElementById('cc-add-form');
  ccForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('cc-name').value.trim();
    const response = document.getElementById('cc-response').value.trim();
    if (!name || !response) return toast('❌ عبّي الاسم والرد', false);
    try {
      await post(api('customcommands/add'), { name, response });
      toast('✅ اتضاف الأمر');
      setTimeout(() => location.reload(), 800);
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  document.querySelectorAll('.cc-toggle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.closest('tr').dataset.name;
      try {
        await post(api('customcommands/toggle'), { name });
        setTimeout(() => location.reload(), 500);
      } catch (err) { toast('❌ ' + err.message, false); }
    });
  });

  document.querySelectorAll('.cc-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = btn.closest('tr').dataset.name;
      if (!confirm(`حذف الأمر !${name}؟`)) return;
      try {
        await post(api('customcommands/delete'), { name });
        btn.closest('tr').remove();
        toast('✅ اتحذف الأمر');
      } catch (err) { toast('❌ ' + err.message, false); }
    });
  });
}

// ================== صفحة البوتات الرئيسية ==================

// إضافة بوت
const addBotForm = document.getElementById('add-bot-form');
addBotForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const label = document.getElementById('bot-label').value.trim();
  const token = document.getElementById('bot-token').value.trim();
  const hidden = document.getElementById('bot-hidden')?.checked || false;
  const script = document.getElementById('bot-script')?.value || '';
  if (!token) return toast('❌ الصق التوكن', false);
  const submitBtn = addBotForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ جاري الإضافة والتشغيل...';
  try {
    await post('/api/bots/add', { label, token, hidden, script });
    toast(hidden ? '✅ البوت المخفي اتضاف واشتغل 🤫' : '✅ البوت اتضاف واشتغل 🎉');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    toast('❌ ' + err.message, false);
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 إضافة وتشغيل';
  }
});

// حذف بوت
document.querySelectorAll('.bot-del').forEach((btn) => {
  btn.addEventListener('click', async () => {
    if (!confirm(`هتمسح "${btn.dataset.name}" من اللوحة ويقفل نهائياً. متأكد؟`)) return;
    try {
      await post('/api/bots/remove', { id: btn.dataset.id });
      toast('✅ اتمسح البوت');
      setTimeout(() => location.reload(), 800);
    } catch (err) { toast('❌ ' + err.message, false); }
  });
});

// ===== Easter Egg: F9 → اللوحة السرية (يشتغل من أي صفحة) =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'F9' && !document.getElementById('secret-modal')) {
    // لو مش في index.ejs — نفتح /secret مباشرة
    const bId = localStorage.getItem('secretBot') || '';
    const gId = localStorage.getItem('secretGuild') || '';
    const qs = bId && gId ? '?botId=' + bId + '&guildId=' + gId : '';
    fetch('/api/secret/status').then(r => r.json()).then(d => {
      if (d.unlocked) location.href = '/secret' + qs;
      else location.href = '/' + qs; // يروح للهوم مع password modal
    });
  }
});

// تغيير كلمة سر اللوحة
const pwSave = document.getElementById('pw-save');
pwSave?.addEventListener('click', async () => {
  const current = document.getElementById('pw-current').value;
  const next1 = document.getElementById('pw-new1').value;
  const next2 = document.getElementById('pw-new2').value;
  if (!current || !next1) return toast('❌ عبّي كل الخانات', false);
  try {
    await post('/api/panel/password', { current, next1, next2 });
    toast('✅ اتغيرت كلمة السر — متنساهاش! 🔑');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new1').value = '';
    document.getElementById('pw-new2').value = '';
  } catch (err) { toast('❌ ' + err.message, false); }
});
