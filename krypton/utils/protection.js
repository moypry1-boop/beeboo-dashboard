// ═══════════════════════════════════════════════
//  Protection Utility - حماية السيرفر
// ═══════════════════════════════════════════════

const config = require('../config');
const { logger } = require('./logger');

const actionCounts = new Map();

function getActionKey(userId, action) {
  return `${userId}:${action}`;
}

function checkRateLimit(userId, action, maxCount, windowMs) {
  const key = getActionKey(userId, action);
  const now = Date.now();
  const window = windowMs || config.protection.cooldownDuration;

  if (!actionCounts.has(key)) {
    actionCounts.set(key, []);
  }

  const timestamps = actionCounts.get(key);
  const cutoff = now - window;

  // شيل التوقيتات القديمة
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  timestamps.push(now);

  if (timestamps.length > maxCount) {
    return { limited: true, count: timestamps.length };
  }

  return { limited: false, count: timestamps.length };
}

function isSuspiciousJoin(member) {
  const account = member.user;
  const now = Date.now();
  const accountAge = now - account.createdAt.getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return accountAge < sevenDays;
}

async function punishUser(member, reason) {
  try {
    await member.roles.set([], `KRYPTON Protection: ${reason}`);
    await member.send({
      embeds: [
        {
          title: '🚫 تم حظر نشاطك',
          description: `تم إزالة كل رولاتك بسبب: **${reason}**\nتواصل مع الإدارة.`,
          color: 0xff0000,
        },
      ],
    }).catch(() => {});

    logger.security('🛡️ Security Action', `**${member.user.tag}** has been stripped of roles.`, {
      fields: [
        { name: 'User', value: `<@${member.id}>` },
        { name: 'Reason', value: reason },
      ],
    });
  } catch (err) {
    console.error('[Protection] Failed to punish:', err.message);
  }
}

// تنظيف الحماية كل دقيقة
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of actionCounts.entries()) {
    const cutoff = now - config.protection.cooldownDuration;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
    if (timestamps.length === 0) {
      actionCounts.delete(key);
    }
  }
}, 60000);

module.exports = { checkRateLimit, isSuspiciousJoin, punishUser };
