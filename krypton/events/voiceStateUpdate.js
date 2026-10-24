// ═══════════════════════════════════════════════
//  Event: voiceStateUpdate - لوج الفويس + Temp Voice
// ═══════════════════════════════════════════════

const { ChannelType } = require('discord.js');
const { logger } = require('../utils/logger');
const config = require('../config');

module.exports = {
  name: 'voiceStateUpdate',
  once: false,

  async execute(oldState, newState, client) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // ═══════ TEMP VOICE ═══════
    if (config.tempVoice.enabled && config.tempVoice.createChannelId) {
      // دخل روم الإنشاء
      if (newChannel && newChannel.id === config.tempVoice.createChannelId && oldChannel?.id !== newChannel.id) {
        try {
          const parentId = config.tempVoice.categoryId || newChannel.parentId;
          const name = (config.tempVoice.channelNameFormat || '🔊 {username}')
            .replace('{username}', member.user.username);

          const vc = await member.guild.channels.create({
            name,
            type: ChannelType.GuildVoice,
            parent: parentId,
            userLimit: 0,
            permissionOverwrites: [
              {
                id: member.id,
                allow: ['ManageChannels'],
              },
            ],
          });

          await member.voice.setChannel(vc).catch(() => {});
          logger.info('🎧 Temp Voice Created', `**${member.user.tag}** created a temp voice channel.`, {
            fields: [
              { name: 'User', value: `<@${member.id}>` },
              { name: 'Channel', value: `<#${vc.id}>` },
            ],
          });

          // حذف تلقائي لو فاضي
          const checkEmpty = setInterval(async () => {
            const ch = client.channels.cache.get(vc.id);
            if (!ch) {
              clearInterval(checkEmpty);
              return;
            }
            if (ch.members.size === 0) {
              clearInterval(checkEmpty);
              await ch.delete('Temp voice empty').catch(() => {});
            }
          }, 15000);

          // حد أقصى للروم المؤقت (ساعة ونص)
          setTimeout(async () => {
            clearInterval(checkEmpty);
            await vc.delete('Temp voice max lifetime').catch(() => {});
          }, 90 * 60 * 1000);
        } catch (err) {
          console.error('[TempVoice] Failed:', err.message);
        }
      }

      // ساب روم مؤقت
      if (oldChannel && oldChannel.members.size === 0) {
        // لو الروم المؤقت فاضي، احذفه بعد فترة
        const isTemp = oldChannel.parentId === config.tempVoice.categoryId;
        if (isTemp && oldChannel.id !== config.tempVoice.createChannelId) {
          setTimeout(async () => {
            const ch = client.channels.cache.get(oldChannel.id);
            if (ch && ch.members.size === 0) {
              await ch.delete('Temp voice empty').catch(() => {});
            }
          }, config.tempVoice.autoDeleteMs || 30000);
        }
      }
    }

    // ═══════ لوجات الفويس العادية ═══════
    if (!oldChannel && newChannel) {
      logger.info('🔊 Voice Join', `**${member.user.tag}** joined voice chat.`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'Channel', value: `<#${newChannel.id}>` },
        ],
      });
    }

    if (oldChannel && !newChannel) {
      logger.info('🔇 Voice Leave', `**${member.user.tag}** left voice chat.`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'Channel', value: `<#${oldChannel.id}>` },
        ],
      });
    }

    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      logger.info('🔄 Voice Switch', `**${member.user.tag}** switched voice channels.`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'From', value: `<#${oldChannel.id}>` },
          { name: 'To', value: `<#${newChannel.id}>` },
        ],
      });
    }
  },
};