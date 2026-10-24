const storage = require('../../storage');
const stats = require('../features/stats');
const { fillPlaceholders } = require('../../utils/helpers');

module.exports = async function (member) {
  const guild = member.guild;
  const s = storage.getGuild(member.client._botId, guild.id);

  // الإحصائيات (مش بتحسب الكيك/البان كخروج؟ نحسبها كلها خروج — أبسط)
  if (!member.user.bot) stats.bump(member.client._botId, guild.id, 'leavesToday');

  // رسالة المغادرة
  const l = s.leave;
  if (l.enabled && l.channelId) {
    const ch = guild.channels.cache.get(l.channelId);
    if (ch && ch.isTextBased()) {
      ch.send(fillPlaceholders(l.message, member)).catch(() => {});
    }
  }
  // لوج الخروج بيتعمل في logger.js (عشان يميّز الكيك/البان من المغادرة العادية)
};
