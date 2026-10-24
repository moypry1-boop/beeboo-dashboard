// ═══════════════════════════════════════════════
//  Button: verify_manual_approve - توثيق يدوي (موافقة الإدارة)
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

module.exports = {
  name: 'verify_manual_approve',

  async execute(interaction, client) {
    // ─── حماية: الستاف فقط يقدر يوافق ───
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
      await member.roles.add(config.ids.verifiedRole).catch(() => {});
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ تم توثيقك!')
            .setDescription('الإدارة وافقت على توثيقك يدوياً. أهلاً بيك في KRYPTON 🛡️')
            .setColor(0x2ecc71),
        ],
      }).catch(() => {});

      logger.verify('✅ Manual Verification', `**${member.user.tag}** verified manually by <@${interaction.user.id}>.`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'Approved By', value: `<@${interaction.user.id}>` },
        ],
      });
    }

    // تحديث رسالة الطلب وتنظيف التخزين
    storage.removeManualApproval(interaction.message.id);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ تم التوثيق اليدوي')
          .setDescription(`تم توثيق <@${userId}> يدوياً بواسطة <@${interaction.user.id}>.`)
          .setColor(0x2ecc71),
      ],
      components: [],
    }).catch(() => {});
  },
};
