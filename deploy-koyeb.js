// ══════════════════════════════════════════════════════════════════════════════
//  Koyeb 1-Click Automated Deployment Script for Beeboo 9 Bots Worker
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLI = path.join(__dirname, 'koyeb.exe');

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  🚀 KOYEB 24/7 BOT WORKER DEPLOYMENT CONTROLLER');
  console.log('══════════════════════════════════════════════════════════════');

  if (!fs.existsSync(CLI)) {
    console.error('❌ koyeb.exe not found in directory.');
    process.exit(1);
  }

  // 1. التحقق من تسجيل الدخول
  let isLoggedIn = false;
  try {
    const whoami = execSync(`"${CLI}" whoami`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    console.log('✅ مسجل الدخول في Koyeb بنجاح:\n', whoami.trim());
    isLoggedIn = true;
  } catch {
    console.log('⚠️ حساب Koyeb غير مسجل بعد في التيرمينال.');
    console.log('\n👉 يرجى تنفيذ هذا الأمر مرة واحدة لربط حسابك:');
    console.log('   .\\koyeb.exe login\n');
  }

  // 2. إعداد المتغيرات البيئية لجميع الـ 9 بوتات
  const envList = [
    'NODE_ENV=production',
    'PORT=10000',
  ];

  for (let i = 1; i <= 9; i++) {
    const val = process.env[`BOT_TOKEN_${i}`];
    if (val) {
      envList.push(`BOT_TOKEN_${i}=${val}`);
    }
  }
  if (process.env.BOT_TOKEN) envList.push(`BOT_TOKEN=${process.env.BOT_TOKEN}`);
  if (process.env.KRYPTON_BOT_TOKEN) envList.push(`KRYPTON_BOT_TOKEN=${process.env.KRYPTON_BOT_TOKEN}`);

  const envFlags = envList.map((e) => `--env "${e}"`).join(' ');

  console.log(`📋 تم تجهيز ${envList.length} متغيراً بيئياً تشمل توكنات الـ 9 بوتات بالكامل.`);

  if (isLoggedIn) {
    try {
      console.log('\n[KOYEB] جارٍ إنشاء التطبيق "beeboo-bots"...');
      try {
        execSync(`"${CLI}" apps create beeboo-bots`, { stdio: 'ignore' });
      } catch {}

      console.log('[KOYEB] جارٍ نشر خدمة worker للـ 9 بوتات على Koyeb (خطة Nano المجانية 100%)...');
      const deployCmd = `"${CLI}" services create bot-worker --app beeboo-bots --git github.com/moypry1-boop/beeboo-dashboard --git-branch main --git-builder buildpack --git-buildpack-run-command "node worker.js" --instance-type nano --regions fra --ports 10000:http --routes /:10000 --checks 10000:http:/health ${envFlags}`;
      
      execSync(deployCmd, { stdio: 'inherit' });
      console.log('\n🎉 تم النشر بنجاح على Koyeb! البوتات تعمل الآن 24/7 في السحابة.');
    } catch (err) {
      console.error('\n🔴 خطأ أثناء النشر عبر CLI:', err.message);
    }
  }
}

main().catch(console.error);
