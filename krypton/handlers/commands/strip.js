// ═══════════════════════════════════════════════
//  Command: /strip - تعقيم حساب مخترق/مشبوه
//  بيعمل: شيل كل الرولات + مسح الرسايل + بان/كيك اختياري
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { isAdmin } = require('../../utils/permissions');
const { logger } = require('../../utils/logger');
const storage = require('../../utils/storage');

module.exports = {
  name: 'strip',

  async execute(interaction, client) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للأدمن فقط.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const action = interaction.options.getString('action') || 'strip'; // strip | ban | kick
    const member = interaction.guild.members.cache.get(target.id);

    if (!member) {
      return interaction.reply({ content: '❌ العضو مش موجود في السيرفر.', ephemeral: true });
    }

    const step = [];
    let messageCount = 0;

    // ─── 1) شيل كل الرولات ───
    await interaction.deferReply();
    try {
      const oldRoles = [...member.roles.cache.keys()].filter((r) => r !== interaction.guild.id);
      await member.roles.set([], 'KRYPTON Security: suspicious account');
      step.push(`✅ شيلت **${oldRoles.length}** رول من <@${member.id}>`);
    } catch (e) {
      step.push(`⚠️ فشل شيل الرولات: ${e.message}`);
    }

    // ─── 2) مسح رسائل العضو مؤخرًا ───
    try {
      for (const [chId, ch] of interaction.guild.channels.cache) {
        if (!ch.isTextBased()) continue;
        if (!ch.permissionsFor(client.user.id)?.has(PermissionFlagsBits.ManageMessages)) continue;
        try {
          const fetched = await ch.messages.fetch({ limit: 100 });
          const toDelete = fetched.filter((m) => m.author.id === target.id);
          if (toDelete.size > 0) {
            await ch.bulkDelete(toDelete, true).catch(() => {});
            messageCount += toDelete.size;
          }
        } catch (e) { /* skip channels */ }
      }
      step.push(`✅ مسحت **${messageCount}** رسالة للعضو`);
    } catch (e) {
      step.push(`⚠️ فشل مسح الرسائل: ${e.message}`);
    }

    // ─── 3) العقوبة (بان/كيك) ───
    let punishmentLine = 'لم يتم طرده (فقط مسح الرولات والرسائل)';
    try {
      if (action === 'ban') {
        await member.ban({ reason: 'KRYPTON Security: suspicious account' });
        punishmentLine = '🔨 تم **حظره** نهائيًا';
      } else if (action === 'kick') {
        await member.kick('KRYPTON Security: suspicious account');
        punishmentLine = '👢 تم **طرده**';
      }
      step.push(punishmentLine);
    } catch (e) {
      step.push(`⚠️ فشل العقوبة: ${e.message}`);
    }

    // ─── لوج ───
    logger.security('🛡️ STRIP EXECUTED', `**${interaction.user.tag}** stripped **${target.tag}**.`, {
      fields: [
        { name: 'User', value: `<@${target.id}>` },
        { name: 'Roles Removed', value: 'all' },
        { name: 'Messages Deleted', value: `${messageCount}` },
        { name: 'Punishment', value: punishmentLine },
      ],
    });

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Security Strip Complete')
      .setDescription(
        `تم تعقيم الحساب المشبوه **${target.tag}**\n\n` +
        step.join('\n')
      )
      .setColor(0xffaa00)
      .setFooter({ text: 'KRYPTON • Security' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
