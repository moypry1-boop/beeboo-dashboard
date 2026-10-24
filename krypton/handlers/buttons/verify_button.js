// ═══════════════════════════════════════════════
//  Button: verify_button - نظام الـ Verify القوي (متعدد الطبقات)
// ═══════════════════════════════════════════════

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config');
const storage = require('../../utils/storage');
const { logger } = require('../../utils/logger');

// ─── تتبّع محاولات الضغط (منع الـ spam) ───
const attempts = new Map();

function checkAttempts(userId) {
  const v = config.verify || {};
  const max = v.maxAttempts || 5;
  const window = v.attemptWindowMs || 60000;
  const now = Date.now();
  const list = (attempts.get(userId) || []).filter(t => now - t < window);
  list.push(now);
  attempts.set(userId, list);
  return list.length > max;
}

function logSecurity(title, desc, extraFields = []) {
  logger.security(`🛡️ ${title}`, desc, { fields: extraFields });
}

module.exports = {
  name: 'verify_button',

  async execute(interaction, client) {
    const member = interaction.member;
    const v = config.verify || {};

    // ─── لو معاه الرول قبل كده ───
    if (member.roles.cache.has(config.ids.verifiedRole)) {
      return interaction.reply({
        content: '✅ أنت بالفعل موثق!',
        ephemeral: true,
      });
    }

    // ─── حماية الـ spam المتكرر ───
    if (checkAttempts(member.id)) {
      logSecurity('⚠️ Verify Spam', `**${member.user.tag}** is spamming the verify button.`, [
        { name: 'User', value: `<@${member.id}>` },
      ]);
      return interaction.reply({
        content: '⏳ أنت بتضغط كتير! استنى شوية وحاول تاني بعد **دقيقة**، وإلا نتخد إجراء.',
        ephemeral: true,
      });
    }

    // ─── 1) إلزام قبول القوانين قبل التوثيق ───
    if (v.requireRules && !storage.hasAcceptedRules(member.id)) {
      const rulesRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('welcome_rules')
          .setLabel('✅ أوافق على القوانين')
          .setStyle(ButtonStyle.Success)
      );
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📜 أولاً وافق على القوانين')
            .setDescription(
              `قبل ما تتوثق لازم تقبل قوانين السيرفر الأول.\n\n` +
              `${config.welcomeCard.rulesText}`
            )
            .setColor(0xf39c12),
        ],
        components: [rulesRow],
        ephemeral: true,
      });
    }

    // ─── 2) فحص سن الحساب (حماية من الحسابات الجديدة/البوتات) ───
    let isSuspicious = false;
    if (v.checkAccountAge) {
      const accountAgeDays = (Date.now() - member.user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
      const minDays = v.minAccountAgeDays || 7;
      if (accountAgeDays < minDays) {
        isSuspicious = true;
        logSecurity('🚨 حساب جديد جداً', `**${member.user.tag}** has a new account (< ${minDays} days) trying to verify.`, [
          { name: 'User', value: `<@${member.id}> (${member.id})` },
          { name: 'Account Age', value: `<t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>` },
        ]);
      }
    }

    // ─── 3) الحسابات المشبوهة تتطلب موافقة الإدارة (بدل التوثيق الفوري) ───
    if (isSuspicious && v.manualApproval) {
      // نحتجز الرول ولا نضيف verified — وننبه الإدارة
      const approvalChannelId = v.approvalChannel || config.ids.logChannel;
      const approvalCh = client.channels.cache.get(approvalChannelId) || client.channels.cache.get(config.ids.logChannel);

      // زر تاكيد للأدمن
      const approveRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_manual_approve')
          .setLabel('✅ وثّق يدوياً')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('verify_manual_deny')
          .setLabel('🚫 ارفض')
          .setStyle(ButtonStyle.Danger)
      );

      const embed = new EmbedBuilder()
        .setTitle('🚨 طلب توثيق دستي (حساب جديد)')
        .setDescription(
          `<@${member.id}> (**${member.user.tag}**) بيحاول يتوثق وحسابه جديد جداً.\n` +
          `**سن الحساب:** <t:${Math.floor(member.user.createdAt.getTime() / 1000)}:R>\n\n` +
          `اقبل التوثيق يدوياً لو هو عنصر حقيقي، أو ارفض.`
        )
        .setColor(0xe74c3c)
        .setFooter({ text: `User ID: ${member.id}` });

      // نحفظ حالة الطلب في الكنفج/التخزين
      if (approvalCh) {
        const msg = await approvalCh.send({
          embeds: [embed],
          components: [approveRow],
          // معلومات لتحديد العضو لاحقاً
          content: `<@${member.id}>`,
        }).catch(() => null);

        if (msg) {
          // حفظ مرجع للعضو عشان زر الموافقة يشتغل
          storage.saveManualApproval(msg.id, {
            userId: member.id,
            channelId: msg.channel.id,
          });
        }
      }

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⏳ في انتظار موافقة الإدارة')
            .setDescription(
              `حسابك جديد جداً (أقل من **${v.minAccountAgeDays || 7} أيام**).\n` +
              `التوثيق التلقائي موقوف لحسابات جديدة عشان الأمان.\n\n` +
              `تم إبلاغ الإدارة، وبيتم توثيقك يدوياً بعد المراجعة.`
            )
            .setColor(0xf39c12),
        ],
        ephemeral: true,
      });
    }

    // ─── 4) التوثيق الفوري (عادي أو مشبوه بدون manualApproval) ───
    try {
      await member.roles.add(config.ids.verifiedRole);

      logger.verify('✅ User Verified', `**${member.user.tag}** has been verified.`, {
        fields: [
          { name: 'User', value: `<@${member.id}> (${member.id})` },
          { name: 'Verify Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>` },
        ],
      });

      return interaction.reply({
        content: '✅ **تم توثيقك بنجاح!**\nأهلاً بيك في KRYPTON 🛡️',
        ephemeral: true,
      });
    } catch (err) {
      console.error('[Verify] Failed to add role:', err.message);
      return interaction.reply({
        content: '❌ حصل خطأ أثناء التوثيق. تواصل مع الإدارة.',
        ephemeral: true,
      });
    }
  },
};
