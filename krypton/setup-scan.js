// ═══════════════════════════════════════════════
//  Setup Scanner - يفحص السيرفر ويكشف الآيديهات
//  شغّل: node setup-scan.js
// ═══════════════════════════════════════════════

const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', async () => {
  console.log(`\n✅ Connected as ${client.user.tag}\n`);

  for (const guild of client.guilds.cache.values()) {
    console.log(`══════════════════════════════════════`);
    console.log(`🏠 Server: ${guild.name} (${guild.id})`);
    console.log(`══════════════════════════════════════`);

    // ─── الرومات ───
    console.log(`\n📁 CHANNELS:`);
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
    const others = guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory);

    for (const cat of categories.values()) {
      console.log(`  📂 [CATEGORY] ${cat.name} => ${cat.id}`);
      const children = others.filter(c => c.parentId === cat.id);
      for (const ch of children.values()) {
        const type = ch.type === ChannelType.GuildText ? 'text' : ch.type === ChannelType.GuildVoice ? 'voice' : ch.type;
        console.log(`     └─ 🔹 ${ch.name} [${type}] => ${ch.id}`);
      }
    }

    for (const ch of others.values()) {
      if (!categories.has(ch.parentId) && !categories.has(ch.id)) {
        const type = ch.type === ChannelType.GuildText ? 'text' : ch.type === ChannelType.GuildVoice ? 'voice' : ch.type;
        console.log(`  🔹 ${ch.name} [${type}] => ${ch.id}`);
      }
    }

    // ─── الرولات ───
    console.log(`\n🏷️ ROLES:`);
    const roles = guild.roles.cache
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => a.position - b.position);

    for (const role of roles.values()) {
      console.log(`  • ${role.name} => ${role.id}`);
    }

    // ─── الويبهوكات ───
    console.log(`\n🪝 WEBHOOKS in text channels:`);
    try {
      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);
      for (const ch of textChannels.values()) {
        const hooks = await ch.fetchWebhooks().catch(() => []);
        for (const hook of hooks.values()) {
          console.log(`  • #${ch.name}: ${hook.name} => ${hook.url}`);
        }
      }
    } catch (err) {
      console.log('  (مقدرش أجيب الويبهوكات)');
    }

    console.log(`\n══════════════════════════════════════\n`);
  }

  client.destroy();
  process.exit(0);
});

client.login(config.token).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});