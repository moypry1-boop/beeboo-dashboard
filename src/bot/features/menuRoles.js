// قوائم الرتب الذاتية (Menu Roles) — عضو يختار رتبته من Dropdown
const { StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const storage = require('../../storage');
const { COLORS } = require('../../utils/helpers');

async function postPanel(client, botId, guild, panel) {
  const ch = guild.channels.cache.get(panel.channelId);
  if (!ch?.isTextBased()) throw new Error('روم القائمة غير صالح');
  if (!panel.roles?.length) throw new Error('ضيف رتب للقائمة الأول');

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`mrselect:${panel.id}`)
    .setPlaceholder('اختار رتبتك')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(panel.roles.slice(0, 25).map((r) => ({
      label: r.label.slice(0, 100),
      value: r.id,
      emoji: r.emoji || undefined,
    })));

  const embed = new EmbedBuilder()
    .setColor(COLORS.main)
    .setTitle(panel.title || '🎭 اختار رتبتك')
    .setDescription('اختار من القايمة تحت وسيتم إعطائك الرتبة تلقائياً.\nلو عايز تشيل الرتبة اختارها تاني.');

  const msg = await ch.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
  panel.messageId = msg.id;
  storage.updateGuild(botId, guild.id, () => {});
  return msg;
}

async function handleSelect(interaction) {
  const botId = interaction.client._botId;
  const guild = interaction.guild;
  const s = storage.getGuild(botId, guild.id);
  const panel = s.menuRoles.panels.find((p) => p.id === interaction.customId.split(':')[1]);
  if (!panel) return interaction.reply({ content: 'القائمة دي اتشالت من الإعدادات.', ephemeral: true });

  const roleId = interaction.values[0];
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return;

  const role = guild.roles.cache.get(roleId);
  if (!role || !role.editable) {
    return interaction.reply({ content: 'معرفش أديك/أشيل الرتبة دي — اتأكد إن رتبتي أعلى منها.', ephemeral: true });
  }

  const has = member.roles.cache.has(roleId);
  if (has) {
    await member.roles.remove(roleId).catch(() => {});
    return interaction.reply({ content: `✅ شيلت منك رتبة **${role.name}**`, ephemeral: true });
  }
  // شيل أي رتبة تانية من نفس القائمة (single-choice)
  for (const r of panel.roles) {
    if (r.id !== roleId && member.roles.cache.has(r.id)) {
      await member.roles.remove(r.id).catch(() => {});
    }
  }
  await member.roles.add(roleId).catch(() => {});
  return interaction.reply({ content: `✅ اديتك رتبة **${role.name}**`, ephemeral: true });
}

module.exports = { postPanel, handleSelect };
