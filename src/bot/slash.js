// تعريف أوامر السلاش + المعالجات + أوامر البريفيكس
const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const storage = require('../storage');
const { COLORS, sendModLog, baseEmbed } = require('../utils/helpers');
const suggestions = require('./features/suggestions');
const menuRoles = require('./features/menuRoles');

const commandData = [
  new SlashCommandBuilder().setName('ban').setDescription('حظر عضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('kick').setDescription('طرد عضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  new SlashCommandBuilder().setName('timeout').setDescription('إسكات عضو (تايم أوت)')
    .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
    .addIntegerOption((o) => o.setName('minutes').setDescription('عدد الدقايق').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('السبب'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('unban').setDescription('فك حظر عضو بالآي دي')
    .addStringOption((o) => o.setName('id').setDescription('آي دي العضو').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  new SlashCommandBuilder().setName('clear').setDescription('مسح رسائل من الشات')
    .addIntegerOption((o) => o.setName('amount').setDescription('العدد (1-100)').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('warn').setDescription('تحذير عضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('السبب').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  new SlashCommandBuilder().setName('warnings').setDescription('عرض تحذيرات عضو')
    .addUserOption((o) => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('suggest').setDescription('ابعت اقتراح للإدارة')
    .addStringOption((o) => o.setName('content').setDescription('الاقتراح').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('شرح البوت'),
].map((c) => c.toJSON());

// ============ معالج أوامر السلاش ============
async function handleSlash(interaction) {
  const botId = interaction.client._botId;
  const guild = interaction.guild;
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'بدون سبب';
  const reply = (msg) => interaction.reply({ content: msg, ephemeral: true }).catch(() => {});

  switch (interaction.commandName) {
    case 'suggest': {
      const content = interaction.options.getString('content');
      try {
        await suggestions.create(interaction.client, guild, interaction.user, content);
        return reply('✅ اتبعت اقتراحك للإدارة، شكراً لك!');
      } catch (e) {
        return reply('❌ ' + e.message);
      }
    }

    case 'help': {
      return interaction.reply({
        embeds: [baseEmbed(COLORS.main)
          .setTitle('📖 أوامر البوت')
          .setDescription(
            '`/ban` `/kick` `/timeout` `/unban` `/clear` `/warn` `/warnings`\n' +
            `وأوامر البريفيكس: \`${storage.getGuild(botId, guild.id).prefix}help\` \`${storage.getGuild(botId, guild.id).prefix}ping\`\n` +
            '⚙️ كل إعدادات البوت من لوحة التحكم'
          )],
      });
    }

    case 'ban': {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) return reply('محتاج صلاحية **Ban Members** للبوت.');
      try {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member && !member.bannable) return reply('مقدرش أحظره (رتبته أعلى مني).');
        await user.send(`تم حظرك من **${guild.name}** | السبب: ${reason}`).catch(() => {});
        await guild.members.ban(user.id, { reason: `${interaction.user.tag}: ${reason}` });
        modLog(guild, '🔨 حظر', interaction.user, user, reason);
        return reply(`✅ تم حظر **${user.tag}**`);
      } catch { return reply('حصل خطأ وأنا بحظره.'); }
    }

    case 'kick': {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) return reply('محتاج صلاحية **Kick Members** للبوت.');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return reply('العضو مش في السيرفر.');
      if (!member.kickable) return reply('مقدرش أطرده (رتبته أعلى مني).');
      await member.kick(`${interaction.user.tag}: ${reason}`);
      modLog(guild, '👢 طرد', interaction.user, user, reason);
      return reply(`✅ تم طرد **${user.tag}**`);
    }

    case 'timeout': {
      const minutes = interaction.options.getInteger('minutes');
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return reply('العضو مش في السيرفر.');
      if (!member.moderatable) return reply('مقدرش أسكاته.');
      await member.timeout(Math.min(minutes, 40320) * 60 * 1000, `${interaction.user.tag}: ${reason}`);
      modLog(guild, '🔇 إسكات', interaction.user, user, `${reason} (${minutes} دقيقة)`);
      return reply(`✅ تم إسكات **${user.tag}** لمدة **${minutes}** دقيقة`);
    }

    case 'unban': {
      const id = interaction.options.getString('id');
      try {
        await guild.members.unban(id);
        return reply(`✅ تم فك الحظر عن \`${id}\``);
      } catch { return reply('العضو ده مش محظور أصلاً.'); }
    }

    case 'clear': {
      const amount = Math.min(interaction.options.getInteger('amount'), 100);
      const msgs = await interaction.channel.bulkDelete(amount, true).catch(() => null);
      return interaction.reply({ content: `🧹 تم مسح **${msgs ? msgs.size : 0}** رسالة`, ephemeral: true });
    }

    case 'warn': {
      storage.updateGuild(botId, guild.id, (s) => {
        s.warnings[user.id] = s.warnings[user.id] || [];
        s.warnings[user.id].push({ reason, by: interaction.user.tag, at: Date.now() });
      });
      await user.send(`⚠️ اتخذت تحذير في **${guild.name}** | السبب: ${reason}`).catch(() => {});
      modLog(guild, '⚠️ تحذير', interaction.user, user, reason);
      return reply(`✅ تم تحذير **${user.tag}** | السبب: ${reason}`);
    }

    case 'warnings': {
      const list = storage.getGuild(botId, guild.id).warnings[user.id] || [];
      if (!list.length) return reply(`**${user.tag}** مفيش عنده أي تحذيرات ✨`);
      const desc = list.map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة \`${w.by}\` — <t:${Math.floor(w.at / 1000)}:R>`).join('\n');
      return interaction.reply({
        embeds: [baseEmbed(COLORS.warn).setTitle(`⚠️ تحذيرات ${user.tag} (${list.length})`).setDescription(desc.slice(0, 4000))],
        ephemeral: true,
      });
    }
  }
}

function modLog(guild, title, moderator, target, reason) {
  sendModLog(guild, baseEmbed(COLORS.bad)
    .setTitle(title)
    .addFields(
      { name: 'الهدف', value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
      { name: 'بواسطة', value: `<@${moderator.id}>`, inline: true },
      { name: 'السبب', value: reason || 'بدون سبب' },
    ));
}

// ============ أوامر البريفيكس ============
async function handlePrefix(message, prefix) {
  const botId = message.client._botId;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();
  if (!cmd) return;
  const s = storage.getGuild(botId, message.guild.id);

  // الأوامر المخصصة
  const custom = s.customCommands.find((c) => c.name === cmd && c.enabled !== false);
  if (custom) {
    return message.reply({ content: custom.response.replace('{user}', `<@${message.author.id}>`) }).catch(() => {});
  }

  switch (cmd) {
    case 'help':
      return message.reply({
        embeds: [baseEmbed(COLORS.main)
          .setTitle('📖 أوامر البوت')
          .setDescription(
            '**بالبريفيكس:** `help` `ping` `warn` `warnings` `cc` (الأوامر المخصصة)\n' +
            '**بسلاش:** `/ban` `/kick` `/timeout` `/clear` `/unban` `/warn`\n' +
            '⚙️ التحكم الكامل من لوحة التحكم'
          )],
      });
    case 'ping':
      return message.reply(`🏓 Pong! \`${message.client.ws.ping}ms\``);
    case 'cc': {
      const list = s.customCommands.filter((c) => c.enabled !== false);
      if (!list.length) return message.reply('مفيش أوامر مخصصة. اعملها من لوحة التحكم ⚙️');
      return message.reply('📜 الأوامر المخصصة: ' + list.map((c) => `\`${prefix}${c.name}\``).join(' '));
    }
  }
}

// ============ أزرار التذاكر ============
async function handleTicketButton(interaction) {
  const botId = interaction.client._botId;
  const guild = interaction.guild;
  const s = storage.getGuild(botId, guild.id);

  if (interaction.customId === 'ticket_open') {
    // منع فتح أكثر من تذكرة
    const existing = guild.channels.cache.find((c) => c.topic === `ticket:${interaction.user.id}`);
    if (existing) return interaction.reply({ content: `عندك تذكرة مفتوحة بالفعل: <#${existing.id}>`, ephemeral: true });

    await interaction.deferReply({ ephemeral: true });
    let opened = 0;
    storage.updateGuild(botId, guild.id, (st) => { st.tickets.opened += 1; opened = st.tickets.opened; });

    const overwrites = [
      { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
      { id: interaction.user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] },
      { id: guild.members.me.id, allow: ['ViewChannel', 'SendMessages', 'ManageChannels'] },
    ];
    if (s.tickets.supportRoleId) {
      overwrites.push({ id: s.tickets.supportRoleId, allow: ['ViewChannel', 'SendMessages'] });
    }

    const channel = await guild.channels.create({
      name: `ticket-${interaction.user.username}`.slice(0, 90),
      type: 0,
      parent: s.tickets.categoryId || null,
      topic: `ticket:${interaction.user.id}`,
      permissionOverwrites: overwrites,
    }).catch(() => null);
    if (!channel) return interaction.editReply('حصل خطأ وإنشاء التذكرة — تأكد إن رتبتي فوق رتبة الكاتيجوري وعندي صلاحية إدارة القنوات.');

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('إغلاق التذكرة').setEmoji('🔒').setStyle(ButtonStyle.Danger)
    );
    await channel.send({
      content: s.tickets.supportRoleId ? `<@&${s.tickets.supportRoleId}>` : undefined,
      embeds: [baseEmbed(COLORS.main)
        .setTitle('🎫 تذكرة دعم')
        .setDescription(`${s.tickets.welcomeMessage || 'اكتب مشكلتك هنا.'}\n\nصاحب التذكرة: <@${interaction.user.id}>`)
        .setFooter({ text: `رقم التذكرة #${opened}` })],
      components: [closeRow],
    });
    return interaction.editReply(`✅ تم فتح تذكرتك: <#${channel.id}>`);
  }

  if (interaction.customId === 'ticket_close') {
    return interaction.reply({
      content: 'متأكد إنك عايز تقفل التذكرة؟',
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('نعم، اقفلها').setStyle(ButtonStyle.Danger),
      )],
    });
  }

  if (interaction.customId === 'ticket_close_confirm') {
    const ch = interaction.channel;
    await interaction.reply({ content: '🔒 جاري قفل التذكرة...', ephemeral: true }).catch(() => {});
    setTimeout(() => ch.delete('قفل التذكرة').catch(() => {}), 3000);
  }
}

module.exports = { commandData, handleSlash, handlePrefix, handleTicketButton };
