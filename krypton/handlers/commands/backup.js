// ═══════════════════════════════════════════════
//  Command: /backup - نسخة احتياطية (إنشاء / استرجاع / قائمة)
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { createBackup, restoreBackup } = require('../../utils/backup');
const storage = require('../../utils/storage');
const { isAdmin } = require('../../utils/permissions');

module.exports = {
  name: 'backup',

  async execute(interaction, client) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: '❌ الأمر ده للأدمن فقط.', ephemeral: true });
    }

    const action = interaction.options.getString('action');

    // ─── إنشاء نسخة ───
    if (action === 'create' || !action) {
      await interaction.deferReply();
      try {
        const backup = await createBackup(interaction.guild, 'manual');
        const embed = new EmbedBuilder()
          .setTitle('💾 Backup Created')
          .setDescription(
            `تم إنشاء نسخة احتياطية كاملة للسيرفر!\n\n` +
            `**📁 ID:** \`${backup.id}\`\n` +
            `**📂 Categories:** ${backup.categories.length}\n` +
            `**💬 Channels:** ${backup.channels.length}\n` +
            `**🎭 Roles:** ${backup.roles.length}\n\n` +
            `للاسترجاع اكتب: \`/backup action:restore\``
          )
          .setColor(0x00ff7f)
          .setFooter({ text: 'KRYPTON • Backup' })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Backup] create error:', err);
        return interaction.editReply({ content: '❌ حصل خطأ أثناء إنشاء النسخة.' });
      }
    }

    // ─── استرجاع نسخة ───
    if (action === 'restore') {
      const backups = storage.getAllBackups();
      const ids = Object.keys(backups);
      if (ids.length === 0) {
        return interaction.reply({ content: '⚠️ مفيش نسخ احتياطية موجودة. اعمل `/backup` الأول.', ephemeral: true });
      }
      const latest = ids.sort((a, b) => (backups[b].createdAt || 0) - (backups[a].createdAt || 0))[0];
      const backup = backups[latest];

      await interaction.deferReply();
      try {
        const results = await restoreBackup(interaction.guild, backup, client);
        const embed = new EmbedBuilder()
          .setTitle('♻️ Backup Restored')
          .setDescription(
            `تم استرجاع السيرفر من النسخة **${latest}**\n\n` +
            `**🎭 Roles:** ${results.rolesCreated} تم إنشاؤها\n` +
            `**💬 Channels:** ${results.channelsCreated} تم إنشاؤها\n\n` +
            `> ⚠️ لاحظ: الرومات اللي موجودة قبل الاسترجاع اتسابت، والرولات/الرومات القديمة اللي اتعملت بعد النسخة مش اتشالت تلقائيًا.`
          )
          .setColor(0x00ff7f)
          .setFooter({ text: 'KRYPTON • Backup' })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('[Backup] restore error:', err);
        return interaction.editReply({ content: '❌ حصل خطأ أثناء الاسترجاع.' });
      }
    }

    // ─── قائمة النسخ ───
    if (action === 'list') {
      const backups = storage.getAllBackups();
      const ids = Object.keys(backups).sort(
        (a, b) => (backups[b].createdAt || 0) - (backups[a].createdAt || 0)
      );
      if (ids.length === 0) return interaction.reply({ content: '⚠️ مفيش نسخ احتياطية.', ephemeral: true });

      const lines = ids.slice(0, 10).map((id, i) => {
        const b = backups[id];
        const time = b.createdAt ? `<t:${Math.floor(b.createdAt / 1000)}:f>` : '?';
        return `**${i + 1}.** \`${id}\` — ${b.guildInfo?.name || 'Unknown'} • ${time} • ${b.channels?.length || 0}ch/${b.roles?.length || 0}rl`;
      });

      const embed = new EmbedBuilder()
        .setTitle('💾 Backups List')
        .setDescription(lines.join('\n'))
        .setColor(0x00ff7f);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    return interaction.reply({ content: '❌ أمر غير معروف.', ephemeral: true });
  },
};
