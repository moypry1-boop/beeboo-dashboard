// ═══════════════════════════════════════════════
//  Scheduler - المجدول (تذكيرات/أعياد/تنظيف)
// ═══════════════════════════════════════════════

const storage = require('./storage');
const { logger } = require('./logger');
const config = require('../config');
const { EmbedBuilder } = require('discord.js');

function startSchedulers(client) {
  // ─── فحص التذكيرات كل 30 ثانية ───
  setInterval(async () => {
    const now = Date.now();
    const reminders = storage.getReminders();
    for (let i = reminders.length - 1; i >= 0; i--) {
      const r = reminders[i];
      if (r.at <= now) {
        try {
          const user = await client.users.fetch(r.userId).catch(() => null);
          if (user) {
            await user.send({
              embeds: [
                new EmbedBuilder()
                  .setTitle('⏰ تذكير')
                  .setDescription(r.text)
                  .setColor(0xf39c12)
                  .setTimestamp(),
              ],
            }).catch(() => {});
          }
        } catch {}
        storage.removeReminderByIndex(i);
      }
    }
  }, 30000);

  // ─── فحص الأعياد يوميًا ───
  setInterval(async () => {
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const birthdays = storage.getBirthdays();

    for (const [userId, bd] of Object.entries(birthdays)) {
      if (bd === todayStr) {
        try {
          const guild = client.guilds.cache.get(config.ids.guild);
          const member = await guild.members.fetch(userId).catch(() => null);
          if (!member) continue;

          // ابعت في الـ system channel أو ويلكوم
          const welcomeCh = guild.channels.cache.get(config.welcomeCard?.welcomeChannel || config.ids.verifyChannel);
          if (welcomeCh) {
            await welcomeCh.send({
              content: `<@${userId}> 🎂`,
              embeds: [
                new EmbedBuilder()
                  .setTitle('🎂 عيد ميلاد سعيد!')
                  .setDescription(`كل سنة وأنت طيب يا **${member.user.username}**! 🎉🎈`)
                  .setColor(0xff69b4)
                  .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                  .setTimestamp(),
              ],
            }).catch(() => {});
          }
        } catch {}
      }
    }
  }, 60 * 60 * 1000); // كل ساعة

  // ─── تنظيف رول newcomer كل يوم ───
  const newcomerRoleId = config.newcomerRoleId || config.newcomer.roleId;
  if (config.newcomer.enabled && newcomerRoleId) {
    setInterval(async () => {
      try {
        const guild = client.guilds.cache.get(config.ids.guild);
        const members = await guild.members.fetch();
        const now = Date.now();

        for (const [, member] of members) {
          if (member.user.bot) continue;
          if (member.roles.cache.has(newcomerRoleId)) {
            const age = now - member.user.createdAt.getTime();
            if (age >= config.newcomer.minAccountAgeMs) {
              await member.roles.remove(newcomerRoleId, 'Account age verification').catch(() => {});
            }
          }
        }
      } catch {}
    }, 12 * 60 * 60 * 1000); // كل 12 ساعة
  }

  // ─── تقرير حضور الستاف الأسبوعي (كل أحد الساعة 23:00) ───
  const { sendWeeklyReport } = require('./staffReport');
  setInterval(async () => {
    const now = new Date();
    if (now.getDay() !== 0) return; // يوم الأحد فقط
    if (now.getHours() !== 23 || now.getMinutes() !== 0) return;
    try {
      const guild = client.guilds.cache.get(config.ids.guild);
      if (guild) await sendWeeklyReport(guild, client);
    } catch (e) { console.error('[Scheduler] weekly report:', e.message); }
  }, 60 * 1000); // كل دقيقة

  // ─── إغلاق تلقائي للشفتات المفتوحة بعد وقت نهاية العمل ───
  const endHour = parseInt((config.staffAttendance.workdayEnd || '23').split(':')[0], 10);
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== endHour || now.getMinutes() !== 0) return;
    // نسجّل إغلاق لكل اللي فاتهم checkout
    const guild = client.guilds.cache.get(config.ids.guild);
    if (!guild) return;
    const staffRoleId = config.staffAttendance.staffRoleId;
    const data = require('./storage');
    try {
      const members = await guild.members.fetch();
      for (const [, m] of members) {
        if (m.user.bot) continue;
        if (!m.roles.cache.has(staffRoleId)) continue;
        if (data.isCheckedIn(m.id)) data.checkOut(m.id);
      }
    } catch {}
  }, 60 * 1000); // كل دقيقة
}

module.exports = { startSchedulers };