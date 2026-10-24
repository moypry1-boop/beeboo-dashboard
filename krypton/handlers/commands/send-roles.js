// ═══════════════════════════════════════════════
//  Command: /send-roles - لوحة الرولات
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const config = require('../../config');

module.exports = {
  name: 'send-roles',

  async execute(interaction, client) {
    const guild = interaction.guild;

    for (const panel of config.roles.panels) {
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
        .addOptions(
          panel.options.map(opt => ({
            label: opt.label,
            description: opt.description || '',
            value: opt.roleId,
          }))
        );

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    return interaction.reply({
      content: '✅ تم إرسال لوحة الرولات بنجاح!',
      ephemeral: true,
    });
  },
};