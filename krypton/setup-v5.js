// ═══════════════════════════════════════════════
//  Setup V5 - الأنظمة الجديدة:
//  1) ownerId (من مالك السيرفر)  2) رول بنت  3) رول أقل من 18
//  4) كاتجوري البوستات  5) تأكيد رول الستاف
//  شغّل: node setup-v5.js
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const configPath = path.join(__dirname, 'config.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function setConfigValue(key, value) {
  let content = fs.readFileSync(configPath, 'utf8');
  const regex = new RegExp(`(${key}:\\s*)['"]?[^'",\\n]*['"]?`, '');
  if (regex.test(content)) {
    content = content.replace(regex, `$1'${value}'`);
    fs.writeFileSync(configPath, content);
    console.log(`  ✓ config: ${key} = ${value}`);
  } else {
    console.log(`  ⚠ config key not found: ${key}`);
  }
}

client.once('ready', async () => {
  console.log(`✅ Connected as ${client.user.tag}\n`);
  const guild = client.guilds.cache.get(config.ids.guild);
  if (!guild) { console.error('❌ الـ guild مش موجود'); client.destroy(); process.exit(1); }

  // ─── 1) ownerId من مالك السيرفر الفعلي ───
  const owner = await guild.fetchOwner();
  console.log(`👑 Server owner: ${owner.user.tag} (${owner.id})`);
  setConfigValue('ownerId', owner.id);
  // نحدّث الكنفیج المت load
  config.ids.ownerId = owner.id;

  // ─── 2) رول بنت ───
  let girlRoleId = config.ids.girlRoleId;
  if (!girlRoleId) {
    const role = await guild.roles.create({ name: '👧 بنت', reason: 'Gender role' });
    girlRoleId = role.id;
    setConfigValue('girlRoleId', girlRoleId);
    console.log(`  ✓ عملت رول البنت: ${girlRoleId}`);
    config.ids.girlRoleId = girlRoleId;
  } else {
    console.log(`  ✓ رول البنت موجود: ${girlRoleId}`);
  }

  // ─── 3) رول أقل من 18 ───
  let underageRoleId = config.ids.underageRoleId;
  if (!underageRoleId) {
    const role = await guild.roles.create({ name: '🔞 أقل من 18', reason: 'Underage role' });
    underageRoleId = role.id;
    setConfigValue('underageRoleId', underageRoleId);
    console.log(`  ✓ عملت رول أقل من 18: ${underageRoleId}`);
    config.ids.underageRoleId = underageRoleId;
  } else {
    console.log(`  ✓ رول أقل من 18 موجود: ${underageRoleId}`);
  }

  // ─── 4) كاتجوري البوستات ───
  let postsCategoryId = config.posts.postsCategoryId;
  if (!postsCategoryId) {
    const cat = await guild.channels.create({
      name: '📦 البوستات',
      type: ChannelType.GuildCategory,
    });
    postsCategoryId = cat.id;
    setConfigValue('postsCategoryId', postsCategoryId);
    console.log(`  ✓ عملت كاتجوري بوستات: ${postsCategoryId}`);
    config.posts.postsCategoryId = postsCategoryId;
  } else {
    console.log(`  ✓ كاتجوري البوستات موجود: ${postsCategoryId}`);
  }

  // ─── 5) تأكيد رول الستاف ───
  const staffRoleId = config.staffAttendance.staffRoleId;
  console.log(`  ℹ️ رول الستاف: ${staffRoleId}`);

  console.log('\n🏁 تم! عايز البوت يتسجل أوامره ويشتغل؟');
  console.log('   node deploy-commands.js  ← نشر الأوامر');
  console.log('   npm start                ← تشغيل البوت');

  client.destroy();
  process.exit(0);
});

client.login(config.token).catch((err) => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});
