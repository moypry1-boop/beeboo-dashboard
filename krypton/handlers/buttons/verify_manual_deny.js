// ═══════════════════════════════════════════════
//  Button: verify_manual_deny - رفض التوثيق اليدوي
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'verify_manual_deny',

  async execute(interaction, client) {
    const { isStaff } = require('../../utils/permissions');
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ انت مش ستاف!', ephemeral: true });
    }

    const approval = storage.getManualApproval(interaction.message.id);
    if (!approval) {
      return interaction.reply({ content: '❌ الطلب ده انتهى أو متعرفش.', ephemeral: true });
    }

    const { userId } = approval;
    const guild = interaction.guild;
    let member;
    try { member = await guild.members.fetch(userId); } catch {}

    if (member) {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('🚫 تم رفض توثيقك')
            .setDescription('الإدارة رفضت طلب توثيقك اليدوي. لو كان فيك مشكلة، تواصل معهم.')
            .setColor(0xe74c3c),
        ],
      }).catch(() => {});

      logger.security('🚫 Verification Denied', `**${member.user.tag}** denied manual verification by <@${interaction.user.id}>.`, {
        fields: [{ name: 'User', value: `<@${member.id}>` }],
      });
    }

    storage.removeManualApproval(interaction.message.id);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('🚫 تم رفض التوثيق')
          .setDescription(`تم رفض توثيق <@${userId}> بواسطة <@${interaction.user.id}>.`)
          .setColor(0xe74c3c),
      ],
      components: [],
    }).catch(() => {});
  },
};
