// ═══════════════════════════════════════════════
//  Event: messageCreate - Leveling + Anti-Spam + منع الكلمات
// ═══════════════════════════════════════════════

const config = require('../config');
const storage = require('../utils/storage');
const { logger } = require('../utils/logger');
const { isStaff } = require('../utils/permissions');

// ─── تتبع الرسايل للسبام ───
const userMessages = new Map();

function trackMessage(userId, channelId) {
  const key = `${userId}:${channelId}`;
  const now = Date.now();
  if (!userMessages.has(key)) userMessages.set(key, []);
  const arr = userMessages.get(key);
  arr.push(now);

  // شيل القديم
  const cutoff = now - config.antiSpam.muteWindow;
  while (arr.length > 0 && arr[0] < cutoff) arr.shift();
  return arr;
}

// ─── كشف الروابط المشبوهة ───
function isSuspiciousLink(content) {
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/i) || content.match(/(?:discord\.gg\/[^\s]+)/i);
  if (!urlMatch) return null;
  const url = urlMatch[1];

  const blacklisted = [
    'grabify.link', 'iplogger.org', 'iplogger.com', '2no.me', 'iplis.ru',
    'blasze.com', 'yip.su', 'stamparm.net', 'fuckip.su', 'freeip.me',
    'ipgrabber.ru', 'whatismyipaddress.com', 'tinyurl.com', 'shorturl.at',
    'bit.ly', 'rb.gy', 'cutt.ly', 'is.gd', 't.co', 'goo.gl', 'ow.ly',
    'buff.ly', 'adf.ly', 'bc.vc', 's.id', 'shorte.st', 'bc.iq', 'kutt.it',
    't2m.io', 'tiny.cc', 'soo.gd', 'atominik.ml', 'aitoken.us', 'pipi.ga',
  ];
  for (const dom of blacklisted) {
    if (url.toLowerCase().includes(dom)) return url;
  }

  if (/(https?:\/\/[^\s]*@[^\s]+)/i.test(url)) return url;
  if (/https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(url)) return url;

  const deceptiveDiscord = [
    /discord[.-]gift/i, /discord-nitro/i, /discordnitro/i, /discord\.hope/i,
    /nitro[.-]give/i, /discord-token/i,
  ];
  for (const pat of deceptiveDiscord) {
    if (pat.test(url)) return url;
  }

  return null;
}

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const member = message.member;
    const isStaffMember = isStaff(member);

    // ═══════════════════════
    //  COUNTING GAME
    // ═══════════════════════
    const countingChannelId = config.countingChannelId || config.counting.channelId;
    if (config.counting.enabled !== false && countingChannelId && message.channel.id === countingChannelId) {
      const num = parseInt(message.content);
      const counting = storage.getCounting();

      if (isNaN(num)) {
        await message.delete().catch(() => {});
        return;
      }

      const expected = counting.lastNumber + 1;

      if (num === expected && message.author.id !== counting.lastUserId) {
        counting.lastNumber = num;
        counting.lastUserId = message.author.id;
        counting.highScore = Math.max(counting.highScore, counting.streak + 1);
        counting.streak += 1;
        storage.saveCounting(counting);
      } else {
        const reason = message.author.id === counting.lastUserId ? 'مينفعش تعدّ مرتين ورا بعض!' : `الرقم الصح كان **${expected}**`;
        await message.delete().catch(() => {});
        await message.channel.send(`❌ **${message.author.username}** خسر! ${reason} — نبدأ من جديد.`).catch(() => {});
        counting.lastNumber = 0;
        counting.lastUserId = null;
        counting.streak = 0;
        storage.saveCounting(counting);
      }
      return;
    }

    // ═══════════════════════
    //  LOCKDOWN - منع الرسايل لما السيرفر مقفول
    // ═══════════════════════
    const lockdown = storage.getLockdown();
    if (lockdown && lockdown.channels && lockdown.channels.includes(message.channelId) && !isStaffMember) {
      return;
    }

    // ═══════════════════════
    //  ANALYTICS - تتبع الرسايل
    // ═══════════════════════
    storage.trackMessage(message.author.id, message.channelId);

    // ═══════════════════════
    //  AUTO-RESPONDER / FAQ
    // ═══════════════════════
    if (
      config.autoResponder && config.autoResponder.enabled &&
      !isStaffMember && message.content &&
      message.content.length < 60
    ) {
      const contentLower = message.content.toLowerCase();
      for (const rule of config.autoResponder.rules) {
        if (rule.triggers.some(t => contentLower.includes(t.toLowerCase()))) {
          await message.reply(rule.response).catch(() => {});
          break;
        }
      }
    }

    // ═══════════════════════
    //  0) كشف روابط سيرفرات تانية
    // ═══════════════════════
    if (config.invitations && config.invitations.enabled) {
      const inviteMatch = message.content.match(/(?:discord\.gg\/|discord\.com\/invite\/)([a-zA-Z0-9_-]+)/i);
      if (inviteMatch) {
        const code = inviteMatch[1].toLowerCase();
        const allowed = (config.invitations.allowlist || []).some(a => {
          const aLower = a.toLowerCase();
          return aLower === code || code.startsWith(aLower);
        });

        if (!allowed) {
          // محدش يستثنى من كشف روابط المتجر التانية (حتى الموثقين، ماعدا الستاف)
          if (!isStaffMember || config.invitations.blockForEveryone) {
            await message.delete().catch(() => {});
            logger.security('🚫 Invite Link Blocked', `**${message.author.tag}** sent a Discord invite.`, {
              fields: [
                { name: 'User', value: `<@${message.author.id}>` },
                { name: 'Code', value: code },
                { name: 'Channel', value: `<#${message.channelId}>` },
              ],
            });
            await message.reply('🚫 ممنوع نشر روابط سيرفرات تانية هنا.').catch(() => {});
            return;
          }
        }
      }
    }

    // ═══════════════════════
    //  1) ANTI-SPAM
    // ═══════════════════════
    if (config.antiSpam && !isStaffMember) {
      const arr = trackMessage(message.author.id, message.channelId);

      // ─── مكت تلقائي ───
      if (arr.length >= config.antiSpam.muteThreshold) {
        try {
          await member.timeout(
            config.antiSpam.muteDuration,
            `Anti-spam: ${arr.length} messages in ${config.antiSpam.muteWindow / 1000}s`
          );

          logger.security('🚨 Anti-Spam Auto-Mute', `**${message.author.tag}** was muted for spamming.`, {
            fields: [
              { name: 'User', value: `<@${message.author.id}>` },
              { name: 'Channel', value: `<#${message.channelId}>` },
              { name: 'Messages', value: `${arr.length}` },
            ],
          });

          await message.channel.send({
            content: `🔇 <@${message.author.id}> اهدى شوية، بتسبم! تم عمل مكت لمدة 10 دقايق.`,
          }).catch(() => {});
        } catch {}
        userMessages.delete(`${message.author.id}:${message.channelId}`);
        return;
      }

      // ─── تهديد ───
      if (arr.length >= config.antiSpam.warnThreshold) {
        await message.reply('⚠️ بطّل سبام يا غالي!').catch(() => {});
      }
    }

    // ═══════════════════════
    //  2) الكلمات الممنوعة
    // ═══════════════════════
    if (config.antiSpam && config.antiSpam.badWords.length > 0 && !isStaffMember) {
      const contentLower = message.content.toLowerCase();
      const found = config.antiSpam.badWords.find(word => contentLower.includes(word.toLowerCase()));

      if (found) {
        await message.delete().catch(() => {});
        logger.security('📵 Bad Word Filtered', `**${message.author.tag}** used a banned word.`, {
          fields: [
            { name: 'User', value: `<@${message.author.id}>` },
            { name: 'Word', value: found },
            { name: 'Message', value: message.content.slice(0, 300) || '[كلمات محذوفة]' },
          ],
        });
        await message.reply('🚫 الرسالة اتشالت بسبب كلمة ممنوعة.').catch(() => {});
      }
    }

    // ═══════════════════════
    //  3) منع اللينكات لغير الموثقين
    // ═══════════════════════
    if (
      config.antiSpam.blockLinksForUnverified &&
      !member.roles.cache.has(config.ids.verifiedRole) &&
      !isStaffMember &&
      /(https?:\/\/|discord\.gg\/)/i.test(message.content)
    ) {
      await message.delete().catch(() => {});
      return;
    }

    // ═══════════════════════
    //  3.5) حماية الروابط المشبوهة (Link/URL Protection)
    //  بترصد أي رابط غريبة/فيشنج/تكسير ويتم إزالته وتنبيه
    // ═══════════════════════
    if (config.linkProtection && config.linkProtection.enabled === true && !isStaffMember) {
      const suspicious = isSuspiciousLink(message.content);
      if (suspicious) {
        await message.delete().catch(() => {});
        logger.security('🛡️ Suspicious Link Blocked', `**${message.author.tag}** sent a suspicious link: ${suspicious}`, {
          fields: [
            { name: 'User', value: `<@${message.author.id}>` },
            { name: 'Link', value: `\`${suspicious}\`` },
            { name: 'Channel', value: `<#${message.channelId}>` },
          ],
        });

        // تنبيه + مكت اختياري
        await message.channel.send(`⚠️ <@${message.author.id}> الرسالة اتشالت لأن فيها رابط مشبوه/خطير.`).catch(() => {});
        if (config.linkProtection.timeout && config.linkProtection.timeout > 0) {
          await member.timeout(config.linkProtection.timeout, 'Suspicious link').catch(() => {});
        }
        return;
      }
    }

    // ═══════════════════════
    //  4) LEVELING (XP)
    // ═══════════════════════
    if (config.leveling.enabled && !isStaffMember) {
      if (storage.canEarnXp(message.author.id, config.leveling.xpCooldown)) {
        const amount = Math.floor(
          config.leveling.minXp + Math.random() * (config.leveling.maxXp - config.leveling.minXp)
        );
        const result = storage.addXp(message.author.id, amount);

        // ─── ليفل أب ───
        if (result.leveledUp) {
          const newLevel = result.after.level;

          // ─── رولات الليفل ───
          let rewardRoleId = null;
          for (const [levelReq, roleId] of config.leveling.levelRewards) {
            if (newLevel >= levelReq) rewardRoleId = roleId;
          }

          if (rewardRoleId) {
            try {
              await member.roles.add(rewardRoleId).catch(() => {});
            } catch {}
          }

          // ─── الإعلان ───
          const announceText = `🎉 مبروك <@${message.author.id}>! وصلت للـ **ليفل ${newLevel}**! 🚀`;

          if (config.leveling.levelUpChannel) {
            const ch = await client.channels.fetch(config.leveling.levelUpChannel).catch(() => null);
            if (ch) await ch.send(announceText).catch(() => {});
          } else {
            await message.channel.send(announceText).catch(() => {});
          }

          logger.success('📈 Level Up', `**${message.author.tag}** reached level **${newLevel}**.`, {
            fields: [
              { name: 'User', value: `<@${message.author.id}>` },
              { name: 'Level', value: `${newLevel}` },
            ],
          });
        }
      }
    }

    // ═══════════════════════
    //  AUTO-PUBLISH (Crosspost)
    // ═══════════════════════
    if (
      config.autoPublish && config.autoPublish.enabled &&
      config.autoPublish.channels.includes(message.channel.id) &&
      message.crosspostable
    ) {
      await message.crosspost().catch(() => {});
    }
  },
};