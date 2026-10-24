// ═══════════════════════════════════════════════
//  Setup New Channels - روم الاقتراحات + الفويس المؤقت
//  شغّل: node setup-new-channels.js
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { execSync } = require('child_process');

const configPath = path.join(__dirname, 'config.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ─── تعديل config.js ───
function setConfigValue(key, value) {
  let content = fs.readFileSync(configPath, 'utf8');
  // نصلح القيمة دي بأي شكل (مقفولة أو مش مقفولة)
  const regex = new RegExp(`(${key}:\\s*)['"]?[^'",\\n]*['"]?`, 'g');
  content = content.replace(regex, `$1'${value}'`);
  fs.writeFileSync(configPath, content);
  console.log(`  ✓ config: ${key} = ${value}`);
}

client.once('ready', async () => {
  console.log(`✅ Connected as ${client.user.tag}\n`);
  const guild = client.guilds.cache.get(config.ids.guild);

  // ─── 1) روم الاقتراحات ───
  let suggestionsChannel = guild.channels.cache.find(c => c.name === '📨┃suggestions');
  if (!suggestionsChannel) {
    const chatCat = guild.channels.cache.get('1543840599973830717');
    suggestionsChannel = await guild.channels.create({
      name: '📨┃suggestions',
      type: ChannelType.GuildText,
      parent: chatCat ? chatCat.id : undefined,
      topic: 'إرسال الاقتراحات بـ /suggest',
    });
    console.log(`  ✓ Created suggestions channel: ${suggestionsChannel.id}`);
  } else {
    console.log(`  ✓ Suggestions channel exists: ${suggestionsChannel.id}`);
  }
  setConfigValue('suggestionsChannel', suggestionsChannel.id);

  // ─── 2) كاتجوري + روم الفويس المؤقت ───
  let voiceCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('VOICE'));
  if (!voiceCategory) {
    voiceCategory = await guild.channels.create({
      name: '🔊 VOICE',
      type: ChannelType.GuildCategory,
    });
    console.log(`  ✓ Created voice category: ${voiceCategory.id}`);
  } else {
    console.log(`  ✓ Voice category exists: ${voiceCategory.id}`);
  }
  setConfigValue('categoryId', voiceCategory.id);

  let createChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name.includes('Join To Create'));
  if (!createChannel) {
    createChannel = await guild.channels.create({
      name: '➕ Join To Create',
      type: ChannelType.GuildVoice,
      parent: voiceCategory.id,
    });
    console.log(`  ✓ Created join-to-create channel: ${createChannel.id}`);
  } else {
    console.log(`  ✓ Join-to-create channel exists: ${createChannel.id}`);
  }
  setConfigValue('createChannelId', createChannel.id);

  // ─── 3) لوحة الرولات ───
  try {
    const rolesChannel = await guild.channels.fetch(config.ids.rolesChannel);
    const panel = config.roles.panels[0];

    const embed = new EmbedBuilder()
      .setTitle(panel.title)
      .setDescription(panel.description)
      .setColor(0x5865f2)
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'KRYPTON • اختار رولاتك من القوائم تحت' })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('roles_select')
      .setPlaceholder('🎭 اختر رولاتك')
      .setMinValues(0)
      .setMaxValues(panel.options.length)
      .addOptions(panel.options.map(opt => ({
        label: opt.label,
        description: opt.description || '',
        value: opt.roleId,
      })));

    await rolesChannel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
    console.log('  ✓ Roles panel sent');
  } catch (err) {
    console.log(`  ⚠ Roles panel failed: ${err.message}`);
  }

  console.log('\n🏁 تم! أعد تشغيل البوت عشان يعمل reload للـ config.');
  client.destroy();
  process.exit(0);
});

client.login(config.token).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});