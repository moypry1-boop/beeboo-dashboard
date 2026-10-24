// ═══════════════════════════════════════════════
//  Event: guildMemberAdd - عضو جديد + حماية
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const { logger } = require('../utils/logger');
const { isSuspiciousJoin, checkRateLimit } = require('../utils/protection');
const config = require('../config');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member, client) {
    // ─── لوج الدخول ───
    logger.info('📥 Member Joined', `**${member.user.tag}** joined the server.`, {
      fields: [
        { name: 'User', value: `<@${member.id}> (${member.id})` },
        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>` },
        { name: 'Member Count', value: `${member.guild.memberCount}` },
      ],
    });

    // ─── كشف الـ RAID ───
    if (config.antiSpam) {
      const raidResult = checkRateLimit(member.guild.id, 'joins', config.antiSpam.raidThreshold, config.antiSpam.raidWindow);
      if (raidResult.limited) {
        logger.security('🚨 RAID DETECTED!', `Too many joins in ${config.antiSpam.raidWindow / 1000}s window. Stripping roles from new members.`, {
          fields: [
            { name: 'Count', value: `${raidResult.count} joins` },
            { name: 'Action', value: 'Protection Mode: ON' },
          ],
        });
      }
    }

    // ─── حساب مشبوه ───
    if (isSuspiciousJoin(member)) {
      logger.security('⚠️ Suspicious Account', `New account joined: **${member.user.tag}**`, {
        fields: [
          { name: 'User', value: `<@${member.id}>` },
          { name: 'Account Age', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>` },
          { name: 'Action', value: 'Flagged for review' },
        ],
      });
    }

    // ─── رول الحسابات الجديدة ───
    if (config.newcomer && config.newcomer.enabled) {
      const newcomerRoleId = config.newcomerRoleId || config.newcomer.roleId;
      if (newcomerRoleId) {
        try {
          await member.roles.add(newcomerRoleId, 'New account protection').catch(() => {});
        } catch {}
      }
    }

    // ─── رسالة الويلكم في روم الويلكوم ───
    try {
      const { buildWelcomeEmbed } = require('../utils/welcomeEmbed');
      const storage = require('../utils/storage');
      const we = config.welcomeEmbed || {};
      const welcomeChId = we.channelId || config.welcomeCard.welcomeChannel;

      // تحديد من دعى العضو (إن أمكن)
      const inviter = await determineInviter(member.guild).catch(() => null);

      const welcomeCh = member.guild.channels.cache.get(welcomeChId);
      if (welcomeCh) {
        // بناء الـ Embed + الأزرار من ملف منفصل (قابل للتعديل من config)
        const { embed, components } = buildWelcomeEmbed(member, inviter);
        await welcomeCh.send({
          content: `<@${member.id}>`,
          embeds: [embed],
          components,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Welcome] Failed:', err.message);
    }

  },
};

/**
 * تحديد اللي دعا العضو عبر مقارنة الـ invites الحالية مع الكاش المحفوظ
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{inviterId: string|null, code: string|null}>}
 */
async function determineInviter(guild) {
  const storage = require('../utils/storage');

  // يُعيد inviterId فقط إذا توفر صلاحية الوصول للـ invites
  let current;
  try {
    current = await guild.invites.fetch();
  } catch (err) {
    // لو البوت مش معاه ManageGuild ما يقدرش يقرا الدعوات
    return { inviterId: null, code: null };
  }

  // يحول الدعوات الحالية إلى خريطة { code: { uses, inviterId } }
  const nowMap = {};
  for (const inv of current.values()) {
    if (!inv.code) continue;
    nowMap[inv.code] = {
      uses: inv.uses || 0,
      inviterId: inv.inviter ? inv.inviter.id : null,
    };
  }

  // الكاش المحفوظ من آخر مرة
  const prev = storage.getInviteState() || {};

  // نبحث عن الكود اللي زاد استخدامه
  for (const code of Object.keys(nowMap)) {
    const before = prev[code];
    const after = nowMap[code];
    if (before && after.uses > before.uses) {
      // حفظ الكاش الجديد قبل العودة
      storage.saveInviteState(nowMap);
      return { inviterId: after.inviterId, code };
    }
    if (!before && after.uses >= 1) {
      // كود جديد مخلوق واستُخدم
      storage.saveInviteState(nowMap);
      return { inviterId: after.inviterId, code };
    }
  }

  // لا فرق — حفظ الكاش وعودة بلا inviter
  storage.saveInviteState(nowMap);
  return { inviterId: null, code: null };
}
