// ═══════════════════════════════════════════════
//  Setup Panels - يبعت لوحات الـ Verify والتيكت
//  شغّل: node setup-panels.js
// ═══════════════════════════════════════════════

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Connected as ${client.user.tag}\n`);

  const guild = client.guilds.cache.get(config.ids.guild);

  // ─── لوحة الـ Verify ───
  const verifyChannel = await guild.channels.fetch(config.ids.verifyChannel);
  const verifyEmbed = new EmbedBuilder()
    .setTitle('🔐 Verification')
    .setDescription(
      '**أهلاً بيك في 𝙺𝚁𝚈𝙿𝚃𝙾𝙽!** 🛡️\n\n' +
      'قبل ما تدخل السيرفر، اضغط على زر **✅ Verify** تحت.\n' +
      'إحنا كده بنتأكد إنك مش بوت وبتاخد رول العضو.'
    )
    .setColor(0x1abc9c)
    .setThumbnail(guild.iconURL({ dynamic: true }))
    .setFooter({ text: 'KRIPTON • Verify to continue' })
    .setTimestamp();

  const verifyRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel('✅ Verify')
      .setStyle(ButtonStyle.Success)
  );

  await verifyChannel.send({ embeds: [verifyEmbed], components: [verifyRow] });
  console.log('✅ Verify panel sent to #verify');

  // ─── لوحة فتح التيكت ───
  const ticketChannel = await guild.channels.fetch(config.ids.ticketChannel);
  const ticketEmbed = new EmbedBuilder()
    .setTitle('🎫 فتح تيكت')
    .setDescription(
      '**مرحباً بك في نظام التذاكر** 🎫\n\n' +
      'اضغط على زر **🎫 فتح تيكت** واختار القسم اللي محتاجه.\n\n' +
      '**الأقسام المتاحة:**\n' +
      '🤖 **bot-script**\n' +
      '🌍 **gain-followers**\n' +
      '📁 **dump-fivem**\n' +
      '📀 **onesync**\n' +
      '🤝 **partners**\n' +
      '📋 **تقديم إداره**\n' +
      '🛠️ **حل المشاكل**\n' +
      '❓ **استفسار**\n\n' +
      'حد أقصى **3 تيكتات** مفتوحة في نفس الوقت.'
    )
    .setColor(0x9b59b6)
    .setFooter({ text: 'KRIPTON • Ticket System' })
    .setTimestamp();

  const ticketRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open')
      .setLabel('🎫 فتح تيكت')
      .setStyle(ButtonStyle.Primary)
  );

  await ticketChannel.send({ embeds: [ticketEmbed], components: [ticketRow] });
  console.log('✅ Ticket panel sent to #tickets');

  console.log('\n🏁 تم تجهيز اللوحات بنجاح!');
  client.destroy();
  process.exit(0);
});

client.login(config.token).catch(err => {
  console.error('❌ Login failed:', err.message);
  process.exit(1);
});