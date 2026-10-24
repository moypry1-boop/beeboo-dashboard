// ═══════════════════════════════════════════════
//  Command: /ticket - إدارة التيكت
// ═══════════════════════════════════════════════

const { PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../utils/logger');
const { isStaff } = require('../../utils/permissions');
const config = require('../../config');

module.exports = {
  name: 'ticket',

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    const channel = interaction.channel;

    if (!isStaff(interaction.member)) {
      return interaction.reply({
        content: '❌ الأمر ده للإدارة فقط.',
        ephemeral: true,
      });
    }

    switch (subcommand) {
      case 'close': {
        // ─── قفل التيكت ───
        logger.ticket('🔒 Ticket Closed', `Ticket **${channel.name}** closed by **${interaction.user.tag}** (command).`, {
          fields: [{ name: 'Closed By', value: `<@${interaction.user.id}>` }],
        });

        await interaction.reply('🔒 جاري إغلاق التيكت خلال 5 ثواني...');

        const archiveChannel = await interaction.guild.channels
          .fetch(config.transcripts.archiveChannel)
          .catch(() => null);

        setTimeout(async () => {
          if (archiveChannel) {
            try {
              const messages = await channel.messages.fetch({ limit: config.transcripts.maxMessages || 500 });
              const { generateTranscript } = require('../../utils/transcript');
              const { AttachmentBuilder } = require('discord.js');
              const html = generateTranscript(channel, [...messages.values()], client);
              const file = new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `${channel.name}-transcript.html` });
              await archiveChannel.send({
                content: `📋 أرشيف التيكت **${channel.name}** — أغلق بواسطة **${interaction.user.tag}**`,
                files: [file],
              }).catch(() => {});
            } catch {}
          }
          await channel.delete(`Ticket closed by ${interaction.user.tag}`).catch(() => {});
        }, 5000);
        break;
      }

      case 'add': {
        // ─── إضافة عضو ───
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
          return interaction.reply({ content: '❌ العضو ده مش موجود.', ephemeral: true });
        }

        await channel.permissionOverwrites.create(member, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });

        logger.ticket('➕ Member Added', `**${interaction.user.tag}** added **${user.tag}** to ticket **${channel.name}**.`, {
          fields: [
            { name: 'Added User', value: `<@${user.id}>` },
            { name: 'Channel', value: `<#${channel.id}>` },
          ],
        });

        await interaction.reply({ content: `✅ تم إضافة <@${user.id}> إلى التيكت.` });
        await channel.send(`👋 أهلاً <@${user.id}>, تم إضافتك إلى التيكت.`);
        break;
      }

      case 'remove': {
        // ─── إزالة عضو ───
        const user = interaction.options.getUser('user');
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) {
          return interaction.reply({ content: '❌ العضو ده مش موجود.', ephemeral: true });
        }

        await channel.permissionOverwrites.delete(member).catch(() => {});

        logger.ticket('➖ Member Removed', `**${interaction.user.tag}** removed **${user.tag}** from ticket **${channel.name}**.`, {
          fields: [
            { name: 'Removed User', value: `<@${user.id}>` },
            { name: 'Channel', value: `<#${channel.id}>` },
          ],
        });

        await interaction.reply({ content: `✅ تم إزالة <@${user.id}> من التيكت.` });
        break;
      }

      case 'rename': {
        // ─── تغيير اسم التيكت ───
        const name = interaction.options.getString('name');
        const cleanName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);

        await channel.setName(cleanName);

        logger.ticket('✏️ Ticket Renamed', `Ticket **${channel.name}** renamed`, {
          fields: [
            { name: 'Renamed By', value: `<@${interaction.user.id}>` },
            { name: 'New Name', value: cleanName },
          ],
        });

        await interaction.reply({ content: `✅ تم تغيير اسم التيكت إلى **${cleanName}**.` });
        break;
      }
    }
  },
};