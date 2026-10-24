// ═══════════════════════════════════════════════
//  Setup Advanced - رول newcomer + روم counting + Announcement
//  شغّل: node setup-advanced.js
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
  content = content.replace(regex, `$1'${value}'`);
  fs.writeFileSync(configPath, content);
  console.log(`  ✓ config: ${key} = ${value}`);
}

client.once('ready', async () => {
  console.log(`✅ Connected as ${client.user.tag}\n`);
  const guild = client.guilds.cache.get(config.ids.guild);

  // ─── 1) رول newcomer ───
  if (config.newcomer.enabled && !config.newcomerRoleId) {
    const role = await guild.roles.create({
      name: '🆕 Newcomer',
      color: '#7f8c8d',
      reason: 'New account protection role',
    });
    setConfigValue('newcomerRoleId', role.id);
    // سنحدّث newcomer.roleId يدويًا بعدين
    console.log(`  ✓ Created newcomer role: ${role.id}`);
  } else {
    console.log(`  ✓ Newcomer role already configured: ${config.newcomerRoleId || config.newcomer.roleId}`);
  }

  // ─── 2) روم counting ───
  if (!config.countingChannelId) {
    const countingChannel = await guild.channels.create({
      name: '🔢┃counting',
      type: ChannelType.GuildText,
      topic: 'عدّ بالترتيب من 1 — مينفعش تعدّ مرتين ورا بعض!',
    });
    setConfigValue('countingChannelId', countingChannel.id);
    console.log(`  ✓ Created counting channel: ${countingChannel.id}`);
  } else {
    console.log(`  ✓ Counting channel already configured: ${config.countingChannelId}`);
  }

  // ─── 3) تحويل روم الإعلانات لنوع Announcement ───
  const annId = config.autoPublish.channels[0];
  if (annId) {
    try {
      const annCh = await guild.channels.fetch(annId);
      // Discord يعطي annChannelType للنوع اللي channel.on('...') تبعه
      if (annCh.type === ChannelType.GuildText) {
        // التغيير للنوع Announcement بيحتاج API تعديل - اختبار هنا
        console.log(`  • Announcements channel is text (${annCh.id}) — auto-publish هتشتغل لو عايز تتحول لـ announcement يدويًا من إعدادات الروم.`);
      }
    } catch (err) {
      console.log(`  ⚠ Announcements channel fetch failed: ${err.message}`);
    }
  }

  console.log('\n🏁 تم! أعد تشغيل البوت.');
  client.destroy();
  process.exit(0);
});

client.login(config.token).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});