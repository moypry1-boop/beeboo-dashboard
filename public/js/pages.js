/* Red Bull — منطق الصفحات الفرعية (يعتمد على toast/post/api من main.js) */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const PT = window.PAGE_TYPE;
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (ts) => new Date(ts).toLocaleString('ar-EG');

  /* ================= الأعضاء ================= */
  if (PT === 'members') {
    const state = { page: 1, q: '', pages: 1 };
    let loading = false;
    const body = $('#members-body');

    async function loadMembers() {
      if (loading) return; // مفيش طلبات متزامنة — دي كانت سبب الـ rate limit
      loading = true;
      body.innerHTML = '<tr><td colspan="3" class="muted">⏳ جاري التحميل...</td></tr>';
      try {
        const res = await fetch(api(`members?search=${encodeURIComponent(state.q)}&page=${state.page}`));
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || 'خطأ');
        state.pages = d.pages;
        $('#members-count').textContent = `${d.total} عضو — صفحة ${d.page} من ${d.pages}`;
        $('#page-info').textContent = `${d.page} / ${d.pages}`;
        $('#prev-page').disabled = d.page <= 1;
        $('#next-page').disabled = d.page >= d.pages;
        if (!d.items.length) { body.innerHTML = '<tr><td colspan="3" class="muted">مفيش نتائج</td></tr>'; return; }
        body.innerHTML = d.items.map((m) => `
          <tr>
            <td>
              <div class="member-cell">
                <img class="m-avatar" src="${m.avatar}" alt="">
                <div>
                  <strong>${esc(m.nickname || m.username)}</strong>${m.bot ? ' <span class="chip sm">BOT</span>' : ''}
                  <small class="muted" dir="ltr">@${esc(m.username)}</small>
                </div>
              </div>
            </td>
            <td>${m.roles.slice(0, 5).map((r) => `<span class="role-dot" style="--rc:${r.color === '#000000' ? '#99aab5' : r.color}">${esc(r.name)}</span>`).join(' ')}${m.roles.length > 5 ? `<span class="muted">+${m.roles.length - 5}</span>` : ''}</td>
            <td class="row-actions">
              ${m.bot ? '' : `
              <button class="btn btn-sm btn-outline mm-act" data-type="timeout" data-id="${m.id}" data-tag="${esc(m.tag)}">⏳</button>
              <button class="btn btn-sm btn-outline mm-act" data-type="kick" data-id="${m.id}" data-tag="${esc(m.tag)}">👢</button>
              <button class="btn btn-sm btn-outline mm-act" data-type="ban" data-id="${m.id}" data-tag="${esc(m.tag)}">🔨</button>
              <button class="btn btn-sm btn-outline mm-act" data-type="warn" data-id="${m.id}" data-tag="${esc(m.tag)}">⚠️</button>`}
              <button class="btn btn-sm btn-primary mm-act" data-type="role" data-id="${m.id}" data-tag="${esc(m.tag)}">🏷️</button>
            </td>
          </tr>`).join('');
      } catch (e) {
        body.innerHTML = `<tr><td colspan="3" class="muted">❌ ${esc(e.message)}</td></tr>`;
      } finally {
        loading = false;
      }
    }

    let deb;
    $('#member-search').addEventListener('input', (e) => {
      clearTimeout(deb);
      deb = setTimeout(() => { state.q = e.target.value.trim(); state.page = 1; loadMembers(); }, 350);
    });
    $('#refresh-members').addEventListener('click', () => loadMembers());
    $('#prev-page').addEventListener('click', () => { if (state.page > 1) { state.page--; loadMembers(); } });
    $('#next-page').addEventListener('click', () => { if (state.page < state.pages) { state.page++; loadMembers(); } });

    // المودال
    const modal = $('#action-modal');
    let pending = null;
    let rolesCache = null;
    const names = { timeout: '🔇 إسكات', untimeout: '🔊 فك الإسكات', kick: '👢 طرد', ban: '🔨 حظر', warn: '⚠️ تحذير', role: '🏷️ رتبة' };

    // حقل اختيار الرتبة (بيظهر بس مع نوع رتبة)
    const roleWrap = document.createElement('div');
    roleWrap.id = 'am-role-wrap';
    roleWrap.style.display = 'none';
    roleWrap.innerHTML = `
      <label>الرتبة</label><select id="am-role"></select>
      <label>العملية</label><select id="am-role-mode"><option value="add">➕ إضافة</option><option value="remove">➖ إزالة</option></select>`;
    $('#am-minutes-wrap').after(roleWrap);

    async function openModal(btn) {
      pending = { type: btn.dataset.type, id: btn.dataset.id, tag: btn.dataset.tag };
      $('#am-title').textContent = `${names[pending.type]} — ${pending.tag}`;
      $('#am-minutes-wrap').style.display = pending.type === 'timeout' ? '' : 'none';
      roleWrap.style.display = pending.type === 'role' ? '' : 'none';
      if (pending.type === 'role' && !rolesCache) {
        roleWrap.querySelector('#am-role').innerHTML = '<option>⏳ تحميل...</option>';
        try {
          const res = await fetch(api('roles/list'));
          const d = await res.json();
          rolesCache = d.roles.filter((r) => r.editable);
          roleWrap.querySelector('#am-role').innerHTML = rolesCache.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
        } catch { roleWrap.querySelector('#am-role').innerHTML = '<option value="">❌ مش لاقي رتب</option>'; }
      }
      modal.classList.remove('hidden');
    }

    body.addEventListener('click', (e) => {
      const btn = e.target.closest('.mm-act');
      if (btn) openModal(btn);
    });
    $('#am-cancel').addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
    $('#am-confirm').addEventListener('click', async () => {
      if (!pending) return;
      const reason = $('#am-reason').value.trim() || 'بدون سبب';
      const btn = $('#am-confirm');
      btn.disabled = true;
      try {
        if (pending.type === 'role') {
          await post(api('member/role'), { memberId: pending.id, roleId: $('#am-role').value, mode: $('#am-role-mode').value });
        } else {
          await post(api('action'), { type: pending.type, userId: pending.id, reason, minutes: $('#am-minutes').value || 10 });
        }
        toast(`✅ تم تنفيذ (${names[pending.type]}) على ${pending.tag}`);
        modal.classList.add('hidden');
        setTimeout(loadMembers, 600);
      } catch (err) { toast('❌ ' + err.message, false); }
      finally { btn.disabled = false; }
    });

    loadMembers();
  }

  /* ================= الرتب ================= */
  if (PT === 'roles') {
    const PERMS = [
      ['Administrator', '👑 أدمن كامل'],
      ['ManageGuild', '⚙️ إدارة السيرفر'],
      ['ManageRoles', '🏷️ إدارة الرتب'],
      ['ManageChannels', '📺 إدارة الرومات'],
      ['KickMembers', '👢 طرد أعضاء'],
      ['BanMembers', '🔨 حظر أعضاء'],
      ['ModerateMembers', '🔇 إسكات أعضاء'],
      ['ManageMessages', '🧹 إدارة الرسائل'],
      ['ViewChannel', '👁️ رؤية الرومات'],
      ['SendMessages', '💬 إرسال رسائل'],
    ];
    function permBoxes(container, checked = []) {
      container.innerHTML = PERMS.map(([k, l]) => `
        <label class="check-item"><input type="checkbox" value="${k}" ${checked.includes(k) ? 'checked' : ''}> ${l}</label>`).join('');
    }
    permBoxes($('#rc-perms'));
    permBoxes($('#re-perms'));

    const tbody = $('#roles-body');
    async function loadRoles() {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">⏳ جاري التحميل...</td></tr>';
      try {
        const res = await fetch(api('roles/list'));
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        $('#roles-total').textContent = d.roles.length;
        tbody.innerHTML = d.roles.map((r) => `
          <tr data-id="${r.id}">
            <td><span class="role-dot big" style="--rc:${r.color === '#000000' ? '#99aab5' : r.color}"></span> <strong>${esc(r.name)}</strong>${r.managed ? ' <span class="chip sm">بوت/نظام</span>' : ''}</td>
            <td>${r.membersCount}</td>
            <td>${r.editable ? '✅' : '🔒 أعلى مني'}</td>
            <td class="row-actions">
              ${r.editable ? `<button class="btn btn-sm btn-outline rl-edit">✏️</button>
              <button class="btn btn-sm btn-danger rl-del">🗑️</button>` : ''}
            </td>
          </tr>`).join('');
      } catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="muted">❌ ${esc(e.message)}</td></tr>`; }
    }

    $('#role-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#rc-name').value.trim();
      if (!name) return toast('❌ اكتب اسم الرتبة', false);
      const perms = $$('#rc-perms input:checked').map((i) => i.value);
      try {
        await post(api('roles/create'), { name, color: $('#rc-color').value, perms });
        toast('✅ اتصنعت الرتبة 🎉');
        $('#rc-name').value = '';
        loadRoles();
      } catch (err) { toast('❌ ' + err.message, false); }
    });

    tbody.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;
      const id = tr.dataset.id;
      if (e.target.closest('.rl-edit')) {
        const res = await fetch(api('roles/list'));
        const d = await res.json();
        const r = d.roles.find((x) => x.id === id);
        if (!r) return;
        $('#re-id').value = r.id;
        $('#re-name').value = r.name;
        $('#re-color').value = r.color === '#000000' ? '#99aab5' : r.color;
        permBoxes($('#re-perms'), []);
        // نجيب صلاحيات الرتبة الفعلية من اللي ظاهرة
        // (الـ API مبيرجعش permissions، فسيبها فاضية للمستخدم يحدد الجديدة)
        $('#re-name').focus();
        toast('ℹ️ عدّل الاسم/اللون/الصلاحيات واعمل حفظ');
      }
      if (e.target.closest('.rl-del')) {
        if (!confirm('حذف الرتبة نهائيًا؟')) return;
        try {
          await post(api('roles/delete'), { roleId: id });
          toast('✅ اتحذفت الرتبة');
          loadRoles();
        } catch (err) { toast('❌ ' + err.message, false); }
      }
    });

    $('#role-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = $('#re-id').value.trim();
      if (!id) return toast('❌ اختار رتبة من الجدول الأول (دوس ✏️)', false);
      const body = { roleId: id };
      if ($('#re-name').value.trim()) body.name = $('#re-name').value.trim();
      if ($('#re-color').value) body.color = $('#re-color').value;
      const perms = $$('#re-perms input:checked').map((i) => i.value);
      if (perms.length) body.perms = perms;
      try {
        await post(api('roles/update'), body);
        toast('✅ اتعديلت الرتبة');
        loadRoles();
      } catch (err) { toast('❌ ' + err.message, false); }
    });

    loadRoles();
  }

  /* ================= Embed Builder ================= */
  if (PT === 'builder') {
    const v = (id) => $(id)?.value.trim() || '';
    window.preview = function preview() {
      const color = v('#eb-color') || '#8b5cf6';
      $('#pv-embed').style.borderColor = color;
      // نص الرسالة فوق الـ embed
      const contentEl = $('#pv-content');
      if (contentEl) { contentEl.textContent = v('#eb-content'); }
      // العنوان والوصف
      const title = $('#pv-title'); title.textContent = v('#eb-title'); title.classList.toggle('hidden', !v('#eb-title'));
      const desc = $('#pv-description'); desc.textContent = v('#eb-description'); desc.classList.toggle('hidden', !v('#eb-description'));
      // المؤلف
      const au = $('#pv-author');
      au.classList.toggle('hidden', !v('#eb-authorName'));
      au.textContent = v('#eb-authorName');
      // الفوتر + الوقت
      const ft = v('#eb-footerText');
      const ts = $('#eb-timestamp').checked ? new Date().toLocaleString('en-GB') : '';
      const f = $('#pv-footer');
      f.textContent = [ft, ts].filter(Boolean).join(' • ');
      f.classList.toggle('hidden', !(ft || ts));
      // صور
      const img = $('#pv-image'), th = $('#pv-thumbnail');
      const showImg = (el, url) => { el.src = url; el.classList.toggle('hidden', !/^https?:\/\//.test(url)); };
      showImg(img, v('#eb-image'));
      showImg(th, v('#eb-thumbnail'));
    };
    preview();

    $('#embed-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const g = (id) => $(id).value;
      const body = {
        channelId: g('#eb-channel'), content: g('#eb-content'),
        title: g('#eb-title'), description: g('#eb-description'), color: g('#eb-color'),
        timestamp: $('#eb-timestamp').checked,
        authorName: g('#eb-authorName'), authorIcon: g('#eb-authorIcon'),
        image: g('#eb-image'), thumbnail: g('#eb-thumbnail'),
        footerText: g('#eb-footerText'), footerIcon: g('#eb-footerIcon'),
        btn1Label: g('#eb-btn1Label'), btn1Url: g('#eb-btn1Url'),
        btn2Label: g('#eb-btn2Label'), btn2Url: g('#eb-btn2Url'),
        btn3Label: g('#eb-btn3Label'), btn3Url: g('#eb-btn3Url'),
      };
      try {
        await post(api('embed/send'), body);
        toast('✅ اتبعتت الرسالة 🎨');
      } catch (err) { toast('❌ ' + err.message, false); }
    });
  }

  /* ================= السحبات ================= */
  if (PT === 'giveaways') {
    $('#gw-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await post(api('giveaways/create'), {
          prize: $('#gw-prize').value,
          channelId: $('#gw-channel').value,
          durationMinutes: $('#gw-duration').value,
          winnerCount: $('#gw-winners').value,
        });
        toast('🎁 اتبدأت السحبة!');
        setTimeout(() => location.reload(), 900);
      } catch (err) { toast('❌ ' + err.message, false); }
    });
    document.querySelectorAll('.gw-reroll').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('إعادة سحب فايز جديد؟')) return;
      try {
        const d = await post(api('giveaways/reroll'), { id: b.dataset.id });
        toast(d.winner ? `🎉 الفايز الجديد: ${d.winner}` : '😔 مفيش مشاركين أصلاً');
      } catch (err) { toast('❌ ' + err.message, false); }
    }));
    document.querySelectorAll('.gw-del').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('حذف السحبة دي من القائمة؟')) return;
      try {
        await post(api('giveaways/delete'), { id: b.dataset.id });
        b.closest('tr').remove();
        toast('✅ اتحذفت');
      } catch (err) { toast('❌ ' + err.message, false); }
    }));
  }

  /* ================= حسابات اللوحة ================= */
  if (PT === 'users') {
    const ME = window.AUTH_USER;
    const list = $('#users-list');
    async function loadUsers() {
      list.innerHTML = '<tr><td class="muted">⏳ جاري التحميل...</td></tr>';
      try {
        const res = await fetch('/api/panel/users');
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        list.innerHTML = d.users.map((u) => `
          <tr>
            <td><strong dir="ltr">${esc(u.username)}</strong> ${u.username === ME ? '<span class="chip sm">أنت</span>' : ''}</td>
            <td><span class="role-badge rb-${u.role}">${u.role === 'owner' ? '👑 مالك' : u.role === 'admin' ? '🛡️ أدمن' : '🔨 مشرف'}</span></td>
            <td>${u.createdAt ? fmtDate(u.createdAt) : '—'}</td>
            <td class="row-actions">${u.username === ME ? '' : `<button class="btn btn-sm btn-danger us-del" data-u="${esc(u.username)}">🗑️ حذف</button>`}</td>
          </tr>`).join('');
      } catch (e) { list.innerHTML = `<tr><td class="muted">❌ ${esc(e.message)}</td></tr>`; }
    }
    $('#user-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await post('/api/panel/users/add', { username: $('#ua-username').value.trim(), password: $('#ua-password').value, role: $('#ua-role').value });
        toast('✅ اتصنع الحساب');
        $('#ua-username').value = ''; $('#ua-password').value = '';
        loadUsers();
      } catch (err) { toast('❌ ' + err.message, false); }
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('.us-del');
      if (!b) return;
      if (!confirm(`حذف حساب "${b.dataset.u}"؟`)) return;
      try {
        await post('/api/panel/users/delete', { username: b.dataset.u });
        toast('✅ اتحذف الحساب');
        loadUsers();
      } catch (err) { toast('❌ ' + err.message, false); }
    });
    // تغيير كلمة السر (نسخة صفحة المستخدمين)
    const pwBtn = $('#upw-save');
    pwBtn?.addEventListener('click', async () => {
      const current = $('#pw-current').value, next1 = $('#pw-new1').value, next2 = $('#pw-new2').value;
      if (!current || !next1) return toast('❌ عبّي كل الخانات', false);
      if (next1 !== next2) return toast('❌ التأكيد مش مطابق', false);
      try {
        await post('/api/panel/password', { current, next1, next2 });
        toast('✅ اتغيرت كلمة السر 🔑');
        $('#pw-current').value = ''; $('#pw-new1').value = ''; $('#pw-new2').value = '';
      } catch (err) { toast('❌ ' + err.message, false); }
    });
    loadUsers();
  }

  /* ================= صفحة السيرفر: التابات الجديدة ================= */
  // (عناصر اختيارية — بتشتغل لو موجودة بس)
  const num = (id, fb) => parseInt($(id)?.value, 10) || fb;

  // Anti-Nuke
  $('#antinuke-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post(api('antinuke'), {
        enabled: $('#an-enabled').checked,
        punish: $('#antinuke-form select[name=punish]').value,
        maxChannelDeletes: num('[name=maxChannelDeletes]', 3),
        maxRoleDeletes: num('[name=maxRoleDeletes]', 3),
        maxBans: num('[name=maxBans]', 3),
        maxKicks: num('[name=maxKicks]', 3),
        alertChannelId: $('#antinuke-form select[name=alertChannelId]').value,
        whitelistIds: $('#antinuke-form input[name=whitelistIds]').value,
      });
      toast('✅ تم حفظ إعدادات Anti-Nuke');
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  // XP
  $('#xp-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post(api('xp/settings'), {
        enabled: $('#xp-enabled').checked,
        xpPerMessage: num('#xp-per', 10),
        cooldownSeconds: num('#xp-cooldown', 60),
        announceChannelId: $('#xp-announce').value,
        levelUpMessage: $('#xp-message').value,
      });
      toast('✅ تم حفظ إعدادات XP');
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  $('#lb-refresh')?.addEventListener('click', async () => {
    const box = $('#leaderboard');
    box.innerHTML = '<tr><td class="muted">⏳ جاري التحميل...</td></tr>';
    try {
      const res = await fetch(api('xp/leaderboard'));
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (!d.leaderboard.length) { box.innerHTML = '<tr><td class="muted">لسه حدش جمع XP 😴</td></tr>'; return; }
      const medals = ['🥇', '🥈', '🥉'];
      box.innerHTML = d.leaderboard.map((r, i) => `
        <tr>
          <td>${medals[i] || `#${i + 1}`}</td>
          <td>${r.avatar ? `<img class="m-avatar" src="${r.avatar}">` : ''} <strong>${esc(r.tag)}</strong></td>
          <td>Lv.<strong>${r.level}</strong></td>
          <td class="muted">${r.xp} XP</td>
        </tr>`).join('');
    } catch (e) { box.innerHTML = `<tr><td class="muted">❌ ${esc(e.message)}</td></tr>`; }
  });

  // Auto-Poster
  $('#ap-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = $('#ap-content').value.trim();
    const hours = num('#ap-hours', 0);
    const daily = $('#ap-daily').value.trim();
    if (!content) return toast('❌ اكتب المحتوى', false);
    if (!hours && !/^\d{2}:\d{2}$/.test(daily)) return toast('❌ حدد تكرار بالساعات أو وقت يومي زي 08:00', false);
    try {
      await post(api('autoposter/add'), { channelId: $('#ap-channel').value, content, everyHours: hours, dailyTime: hours ? '' : daily });
      toast('✅ اتنضاف الرسالة المجدولة');
      setTimeout(() => location.reload(), 700);
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  document.querySelectorAll('.ap-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف الرسالة المجدولة؟')) return;
    try { await post(api('autoposter/delete'), { id: b.dataset.id }); b.closest('tr').remove(); toast('✅ اتحذف'); }
    catch (err) { toast('❌ ' + err.message, false); }
  }));
  document.querySelectorAll('.ap-now').forEach((b) => b.addEventListener('click', async () => {
    try { await post(api('autoposter/send-now'), { id: b.dataset.id }); toast('📤 اتبعتت'); }
    catch (err) { toast('❌ ' + err.message, false); }
  }));

  // الاقتراحات
  $('#sg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post(api('suggestions/settings'), { enabled: $('#sg-enabled').checked, channelId: $('#sg-channel').value });
      toast('✅ تم حفظ إعدادات الاقتراحات');
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  // Menu Roles
  let mrRolesCache = null;
  $('#mr-add-role')?.addEventListener('click', async () => {
    const box = $('#mr-roles-list');
    if (box.children.length >= 25) return toast('❌ الحد الأقصى 25 رتبة', false);
    if (!mrRolesCache) {
      try {
        const res = await fetch(api('roles/list'));
        const d = await res.json();
        mrRolesCache = d.roles.filter((r) => r.editable);
      } catch { return toast('❌ مقدرتش جيب الرتب', false); }
    }
    const opts = mrRolesCache.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
    const row = document.createElement('div');
    row.className = 'mr-row';
    row.innerHTML = `
      <select class="mr-role">${opts}</select>
      <input type="text" class="mr-label" placeholder="اسم الزر (اختار هنا)" maxlength="100">
      <input type="text" class="mr-emoji" placeholder="😀" maxlength="8" style="width:70px;text-align:center">
      <button type="button" class="btn btn-sm btn-danger mr-row-del">🗑️</button>`;
    box.appendChild(row);
  });
  document.getElementById('mr-roles-list')?.addEventListener('click', (e) => {
    if (e.target.closest('.mr-row-del')) e.target.closest('.mr-row').remove();
  });
  $('#mr-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const roles = $$('#mr-roles-list .mr-row').map((r) => ({
      id: r.querySelector('.mr-role').value,
      label: r.querySelector('.mr-label').value.trim(),
      emoji: r.querySelector('.mr-emoji').value.trim(),
    })).filter((r) => r.label);
    if (!roles.length) return toast('❌ ضيف رتبة واحدة على الأقل مع اسم زر', false);
    try {
      await post(api('menuroles/save'), { panel: { title: $('#mr-title').value, channelId: $('#mr-channel').value, roles } });
      toast('💾 اتحفظت القائمة — دوس نشر عشان تنزل في الروم');
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  document.querySelectorAll('.mr-post').forEach((b) => b.addEventListener('click', async () => {
    try { await post(api('menuroles/post'), { id: b.dataset.id }); toast('📮 اتنشرت القائمة'); }
    catch (err) { toast('❌ ' + err.message, false); }
  }));
  document.querySelectorAll('.mr-del').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف القائمة المحفوظة؟')) return;
    try { await post(api('menuroles/delete'), { id: b.dataset.id }); b.closest('tr').remove(); toast('✅ اتحذف'); }
    catch (err) { toast('❌ ' + err.message, false); }
  }));

  // صورة الترحيب
  $('#wi-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await post(api('welcomeimage/settings'), {
        enabled: $('#wi-enabled').checked,
        bgColor1: $('#wi-c1').value, bgColor2: $('#wi-c2').value, textColor: $('#wi-text').value,
      });
      toast('✅ تم حفظ إعدادات الصورة');
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  $('#wi-test')?.addEventListener('click', async () => {
    try { await post(api('welcomeimage/test'), {}); toast('🖼️ اتبعتت صورة تجريبية في روم الترحيب'); }
    catch (err) { toast('❌ ' + err.message, false); }
  });

  // Lockdown
  $('#lockdown-btn')?.addEventListener('click', async (e) => {
    const lock = e.currentTarget.dataset.lock === 'true';
    if (!confirm(lock ? '🚨 هيقفل إرسال الرسائل في كل السيرفر! متأكد؟' : 'هيفك القفل عن كل الرومات، متأكد؟')) return;
    try {
      const d = await post(api('lockdown'), { lock });
      toast(`✅ تم — ${d.channels} قناة`);
      setTimeout(() => location.reload(), 800);
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  // استيراد الإعدادات
  $('#import-settings')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('هتستبدل إعدادات السيرفر ده بإعدادات الملف. متأكد؟')) { e.target.value = ''; return; }
    try {
      const parsed = JSON.parse(await file.text());
      await post(api('settings/import'), { settings: parsed.settings || parsed });
      toast('✅ اتركّبت الإعدادات 🎉');
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast('❌ ' + (err.message.includes('JSON') ? 'الملف مش JSON صالح' : err.message), false); }
  });

  /* ================= شكل البوت (البروفايل) ================= */
  if (PT === 'profile') {
    const BID = document.querySelector('.server-page')?.dataset.bot; // آي دي البوت من الصفحة نفسها
    const apiBot = (p) => `/api/bot/${BID}/${p}`;
    const STATUS_TXT = { online: 'أونلاين', idle: 'خامل', dnd: 'مشغول', invisible: 'يبدو أوفلاين' };
    const ACT_PREFIX = { '0': '🎮 يلعب ', '1': '📺 بث مباشر: ', '2': '🎵 يستمع إلى ', '3': '👀 يشاهد ', '5': '🏆 يتنافس في ', '4': '' };
    let avatarPayload = null; // dataURL أو URL جاهزين للإرسال

    // ===== المعاينة اللحظية =====
    function refreshPreview() {
      const status = $('#ps-status').value;
      const type = $('#ps-type').value;
      const name = $('#ps-name').value.trim();

      // النقط
      ['#pv-dot', '#pv2-dot', '#pv3-dot'].forEach((s) => {
        const el = $(s); if (!el) return;
        el.className = el.className.replace(/st-\w+/g, '').trim() + ' st-' + status;
        if (el.id === 'pv-dot') el.classList.add('status-dot');
        if (el.classList.contains('sm')) el.classList.add('sm');
      });

      // الاسم والنشاط
      const uname = $('#pr-username').value.trim();
      ['#pv2-name', '#pv3-name'].forEach((s) => { const el = $(s); if (el && uname) el.textContent = uname; });

      let actText = '';
      if (type === 'none' || !name) actText = '';
      else actText = (ACT_PREFIX[type] || '') + name;

      const a2 = $('#pv2-activity');
      if (a2) a2.textContent = actText || '—';
      const a3 = $('#pv3-activity');
      if (a3) a3.textContent = actText;

      const st2 = $('#pv2-status-text');
      if (st2) st2.textContent = STATUS_TXT[status];

      // حقل لينك البث
      $('#ps-stream-wrap').style.display = type === '1' ? '' : 'none';
      // تسمية حقل النص
      $('#ps-name-label').textContent = type === '4' ? 'نص الستاتس المخصص' : 'نص النشاط';
    }

    // ===== الصورة: رفع من الجهاز → تصغير 512 → base64 =====
    $('#pr-file')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        const isGif = file.type === 'image/gif';
        let finalUrl = dataUrl;
        if (!isGif) {
          // تصغير عبر canvas لـ 512×512 PNG
          const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error('الصورة مش صالحة'));
            i.src = dataUrl;
          });
          const c = document.createElement('canvas');
          c.width = 512; c.height = 512;
          const ctx = c.getContext('2d');
          // قص مركزي مربع
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
          finalUrl = c.toDataURL('image/png');
        } else if (file.size > 8 * 1024 * 1024) {
          throw new Error('الجيف أكبر من 8MB — ديسكورد مش هيقبله');
        }
        avatarPayload = finalUrl;
        ['#pv-avatar', '#pv2-avatar', '#pv3-avatar'].forEach((s) => { const el = $(s); if (el) el.src = finalUrl; });
        toast('🖼️ الصورة جاهزة — دوس حفظ البروفايل عشان تنزل لديسكورد');
      } catch (err) { toast('❌ ' + err.message, false); }
    });

    // رابط صورة
    $('#pr-url')?.addEventListener('input', (e) => {
      const u = e.target.value.trim();
      if (/^https?:\/\/\S+$/.test(u)) {
        avatarPayload = u;
        ['#pv-avatar', '#pv2-avatar', '#pv3-avatar'].forEach((s) => { const el = $(s); if (el) el.src = u; });
      }
    });

    // حفظ البروفايل
    $('#pr-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      if ($('#pr-username').value.trim()) body.username = $('#pr-username').value.trim();
      if (avatarPayload) body.avatarData = avatarPayload;
      if (!Object.keys(body).length) return toast('❌ غيّر حاجة الأول', false);
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const d = await post(apiBot('profile'), body);
        toast('✅ تم! ' + (d.changed || []).join(' · '));
        $('#pv-tag').textContent = d.tag || $('#pv-tag').textContent;
        avatarPayload = null;
        $('#pr-file').value = ''; $('#pr-url').value = '';
      } catch (err) { toast('❌ ' + err.message, false); }
      finally { btn.disabled = false; }
    });

    // حفظ الحالة
    $('#ps-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await post(apiBot('presence'), {
          status: $('#ps-status').value,
          activityType: $('#ps-type').value,
          activityName: $('#ps-name').value,
          streamUrl: $('#ps-stream')?.value || '',
        });
        toast('✅ اتحدثت حالة البوت لايف 🎉');
      } catch (err) { toast('❌ ' + err.message, false); }
    });

    // أي تغيير → معاينة
    ['#ps-status', '#ps-type'].forEach((s) => $(s)?.addEventListener('change', refreshPreview));
    $('#ps-name')?.addEventListener('input', refreshPreview);
    $('#pr-username')?.addEventListener('input', refreshPreview);
    refreshPreview();
  }
  /* ================= قعود صوتي + الميوزك ================= */
  // القعود
  $('#vs-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = $('#vs-enabled').checked;
    if (enabled && !$('#vs-channel').value) return toast('❌ اختار الروم الصوتية الأول', false);
    try {
      await post(api('voicestay'), { enabled, channelId: enabled ? $('#vs-channel').value : '' });
      toast(enabled ? '🔊 البوت دخل الروم وهيقعد فيها 24/7' : '🔇 اتلغى القعود والبوت خرج');
      setTimeout(refreshVsStatus, 800);
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  function refreshVsStatus() {
    const box = $('#vs-status'); if (!box) return;
    fetch(api('voicestay')).then((r) => r.json()).then((d) => {
      if (!d.ok) throw new Error(d.error);
      const chName = d.channelId ? (d.channelId) : '—';
      box.innerHTML = `
        <tr><td>الميزة</td><td>${d.enabled ? '<span class="badge on">مفعّلة ✅</span>' : '<span class="badge off">متوقفة</span>'}</td></tr>
        <tr><td>الروم المستهدفة</td><td dir="ltr"><code>${esc(chName)}</code></td></tr>
        <tr><td>البوت دلوقتي في</td><td>${d.inChannel ? `<code dir="ltr">${esc(d.inChannel)}</code> 🟢` : '<span class="muted">مش في صوتية</span>'}</td></tr>`;
    }).catch(() => { box.innerHTML = '<tr><td class="muted">❌ مش قادر يجيب الحالة</td></tr>'; });
  }
  refreshVsStatus();
  setInterval(() => {
    if ($('#vs-status') && document.getElementById('tab-voicestay')?.classList.contains('active')) refreshVsStatus();
  }, 5000);

  // ================= الرد التلقائي (AI) =================
  $('#ai-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = $('#ai-enabled').checked;
    const channelId = ($('#ai-channel').value || '').trim().replace(/\D/g, '').slice(0, 25);
    try {
      await post(api('ai'), { enabled, channelId });
      toast(enabled ? '🤖 الرد التلقائي شغال' : '🤖 اتوقف الرد التلقائي');
      refreshAiStatus();
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  function refreshAiStatus() {
    const box = $('#ai-status'); if (!box) return;
    fetch(api('ai')).then((r) => r.json()).then((d) => {
      if (!d.ok) throw new Error(d.error);
      box.innerHTML = `
        <tr><td>الرد التلقائي</td><td>${d.enabled ? '<span class="badge on">شغال ✅</span>' : '<span class="badge off">متوقف</span>'}</td></tr>
        <tr><td>النطاق</td><td>يرد على أي رسالة في أي قناة 💬</td></tr>
        <tr><td>الذكاء</td><td>${d.hasKey ? '✨ Gemini متصل — ردود ذكية' : '⚡ بالكلمات المفتاحية فقط (مين عملك؟ → بيبو عمك)'}</td></tr>`;
    }).catch(() => { box.innerHTML = '<tr><td class="muted">❌ مش قادر يجيب الحالة</td></tr>'; });
  }
  refreshAiStatus();

  // ================= نظام الستريك (Streaks) =================
  $('#st-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const enabled = $('#st-enabled').checked;
    const forumChannelId = ($('#st-forum').value || '').trim().replace(/\D/g, '').slice(0, 25);
    const announceChannelId = ($('#st-announce').value || '').trim().replace(/\D/g, '').slice(0, 25);
    const senderBotId = ($('#st-sender')?.value || BOT_ID || '').trim().replace(/\D/g, '').slice(0, 25);
    if (enabled && !forumChannelId) return toast('❌ حدد قناة الفروم الأول', false);
    try {
      await post(api('streaks'), { enabled, forumChannelId, announceChannelId, senderBotId });
      toast(enabled ? '🔥 نظام الستريك شغال' : '🔥 اتوقف نظام الستريك');
      refreshStreaks();
    } catch (err) { toast('❌ ' + err.message, false); }
  });
  async function refreshStreaks() {
    const box = $('#st-leaderboard'); if (!box) return;
    const statusBox = $('#st-status');
    fetch(api('streaks')).then((r) => r.json()).then((d) => {
      if (!d.ok) throw new Error(d.error);
      if (statusBox) statusBox.innerHTML = `<tr><td>نظام الستريك</td><td>${d.enabled ? '<span class="badge on">شغال ✅</span>' : '<span class="badge off">متوقف</span>'}</td></tr>`;
      if (!d.users || d.users.length === 0) {
        box.innerHTML = '<tr><td class="muted">لسه محدش نزل صورة — أول ستريك هيبدأ هنا 🔥</td></tr>';
        return;
      }
      box.innerHTML = d.users.map((u, i) => `
        <tr>
          <td>${i + 1}️⃣ <strong>${esc(u.userId.slice(-6))}</strong></td>
          <td>🔥 <strong>${u.count}</strong></td>
          <td>🛡️ ${u.shields}</td>
          <td>🏆 ${u.best}</td>
        </tr>`).join('');
    }).catch(() => { box.innerHTML = '<tr><td class="muted">❌ مش قادر يجيب الترتيب</td></tr>'; });
  }
  if ($('#tab-streaks')) {
    refreshStreaks();
    setInterval(() => { if (document.getElementById('tab-streaks')?.classList.contains('active')) refreshStreaks(); }, 5000);
  }

  // الميوزك
  let muBusy = false;
  $('#mu-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (muBusy) return;
    const query = $('#mu-query').value.trim();
    if (!query) return toast('❌ اكتب اسم الأغنية أو الرابط', false);
    muBusy = true;
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '⏳ جاري التشغيل...';
    try {
      await post(api('music/play'), { query });
      toast('🎵 اتبعتت — بتشتغل!');
      $('#mu-query').value = '';
      refreshMusic();
    } catch (err) { toast('❌ ' + err.message, false); }
    finally { muBusy = false; btn.disabled = false; btn.textContent = '▶️ شغّل'; }
  });

  const muAct = (path, okMsg) => async () => {
    try { await post(api(`music/${path}`), {}); if (okMsg) toast(okMsg); refreshMusic(); }
    catch (err) { toast('❌ ' + err.message, false); }
  };
  $('#mu-pause')?.addEventListener('click', muAct('pause'));
  $('#mu-resume')?.addEventListener('click', muAct('resume'));
  $('#mu-skip')?.addEventListener('click', muAct('skip', '⏭️ شغال اللي بعدها'));
  $('#mu-stop')?.addEventListener('click', muAct('stop', '⏹️ وقف كل حاجة'));

  $('#mu-vol-set')?.addEventListener('click', async () => {
    try {
      const d = await post(api('music/volume'), { value: $('#mu-vol').value });
      $('#mu-vol-num').textContent = d.volume + '%';
      toast(`🔊 الفوليوم بقى ${d.volume}%`);
    } catch (err) { toast('❌ ' + err.message, false); }
  });

  function refreshMusic() {
    if (!$('#mu-queue')) return;
    fetch(api('music/status')).then((r) => r.json()).then((d) => {
      if (!d.ok) return;
      // الشريط الحالي
      const eq = $('#mu-eq');
      eq.classList.toggle('playing', d.active && !d.paused);
      const thumb = $('#mu-now-thumb');
      if (d.current) {
        $('#mu-now-name').textContent = d.current.name;
        $('#mu-now-meta').textContent = `${d.paused ? '⏸️ متوقفة مؤقتًا' : '▶️ بتشتغل'} · ${d.current.duration || ''} · ${d.current.uploader || ''}`;
        if (d.current.thumbnail) { thumb.src = d.current.thumbnail; thumb.classList.remove('hidden'); }
        else thumb.classList.add('hidden');
      } else {
        $('#mu-now-name').textContent = 'مفيش حاجة شغالة';
        $('#mu-now-meta').textContent = '— شغّل أغنية من فوق';
        thumb.classList.add('hidden');
      }
      // القائمة
      $('#mu-count').textContent = d.songs.length;
      $('#mu-queue').innerHTML = d.songs.length
        ? d.songs.map((s, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${s.thumbnail ? `<img src="${s.thumbnail}" style="width:38px;height:28px;border-radius:5px;object-fit:cover;vertical-align:middle;margin-inline-end:8px">` : ''}<strong>${esc(s.name)}</strong><br><small class="muted">${esc(s.uploader)} · ${s.duration}</small></td>
            <td><button class="btn btn-sm btn-danger mu-rm" data-i="${i}">🗑️</button></td>
          </tr>`).join('')
        : '<tr><td class="muted">القائمة فاضية</td></tr>';
    }).catch(() => {});
  }
  $('#mu-queue')?.addEventListener('click', async (e) => {
    const b = e.target.closest('.mu-rm'); if (!b) return;
    try { await post(api('music/remove'), { index: b.dataset.i }); toast('✅ اتمسحت من القائمة'); refreshMusic(); }
    catch (err) { toast('❌ ' + err.message, false); }
  });
  refreshMusic();
  setInterval(() => {
    if ($('#mu-queue') && document.getElementById('tab-music')?.classList.contains('active')) refreshMusic();
  }, 3000);
})();
