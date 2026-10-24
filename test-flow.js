// اختبار سريع لتدفق اللوحة (يشتغل والسيرفر شغال على 3000)
const BASE = 'http://localhost:3000';

async function main() {
  let cookie = '';

  // 1) صفحة اللوجين
  const r1 = await fetch(BASE + '/login');
  console.log('GET /login ->', r1.status);
  const setC = r1.headers.get('set-cookie') || '';
  cookie = setC.split(';')[0];

  // 2) API بدون تسجيل دخول
  const r2 = await fetch(BASE + '/api/bots/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ token: 'x' }),
  });
  console.log('API بدون دخول ->', r2.status, '(المفروض 401)');

  // 3) كلمة سر غلط
  const r3 = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'username=admin&password=wrong',
    redirect: 'manual',
  });
  console.log('كلمة سر غلط ->', r3.status, r3.headers.get('location'), '(المفروض /login?err=1)');
  const sc = r3.headers.get('set-cookie');
  if (sc) cookie = sc.split(';')[0];

  // 4) كلمة سر صح
  const r4 = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: 'username=admin&password=admin123',
    redirect: 'manual',
  });
  const sc4 = r4.headers.get('set-cookie');
  if (sc4) cookie = sc4.split(';')[0];
  console.log('كلمة سر صح ->', r4.status, r4.headers.get('location'), '(المفروض / )');

  // 5) الصفحة الرئيسية بعد الدخول
  const r5 = await fetch(BASE + '/', { headers: { Cookie: cookie } });
  const html5 = await r5.text();
  console.log('GET / ->', r5.status, '| فورم إضافة بوت:', html5.includes('add-bot-form'));

  // 5ب) الصفحات الجديدة
  const ru = await fetch(BASE + '/panel/users', { headers: { Cookie: cookie } });
  const hu = await ru.text();
  console.log('GET /panel/users ->', ru.status, '| فورم إضافة حساب:', hu.includes('user-add-form'));
  const ra = await fetch(BASE + '/panel/auditlog', { headers: { Cookie: cookie } });
  console.log('GET /panel/auditlog ->', ra.status);
  const au = await fetch(BASE + '/api/panel/users', { headers: { Cookie: cookie } });
  const ju = await au.json();
  console.log('API users ->', au.status, '| عدد الحسابات:', ju.users?.length);
  const rm = await fetch(BASE + '/server/x/y/members', { headers: { Cookie: cookie }, redirect: 'manual' });
  console.log('صفحة أعضاء بوت مش موجود ->', rm.status, '(المفروض 302 للرئيسية)');

  // 6) إضافة توكن غلط
  const r6 = await fetch(BASE + '/api/bots/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ label: 'تجربة', token: 'invalid_token_abc' }),
  });
  const j6 = await r6.json();
  console.log('توكن غلط ->', r6.status, j6.error);

  // 7) تغيير كلمة السر (الحالية غلط)
  const r7 = await fetch(BASE + '/api/panel/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ current: 'nope', next1: 'newpass123', next2: 'newpass123' }),
  });
  const j7 = await r7.json();
  console.log('تغيير سر بكلمة غلط ->', r7.status, j7.error, '(المفروض 400)');

  // 8) تسجيل خروج ثم الرئيسية
  const r8 = await fetch(BASE + '/logout', { headers: { Cookie: cookie }, redirect: 'manual' });
  const sc8 = r8.headers.get('set-cookie');
  console.log('خروج ->', r8.status, r8.headers.get('location'));
  const c8 = (sc8 || '').split(';')[0] || cookie;
  const r9 = await fetch(BASE + '/', { headers: { Cookie: c8 }, redirect: 'manual' });
  console.log('الرئيسية بعد الخروج ->', r9.status, '(المفروض 302 لـ /login)');

  console.log('\\n=== ALL TESTS DONE ===');
}

main().catch((e) => { console.error('TEST ERR:', e); process.exit(1); });
