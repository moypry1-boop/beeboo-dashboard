// ═══════════════════════════════════════════════
//  Utilities: staffReport - تقرير حضور الستاف الأسبوعي
// ═══════════════════════════════════════════════

const { EmbedBuilder } = require('discord.js');
const config = require('../config');
const storage = require('./storage');

function formatMinutes(ms) {
  const minutes = Math.round(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

async function sendWeeklyReport(guild, client) {
  const chanId = config.staffAttendance.weeklyReportChannelId;
  if (!chanId) return;
  const chan = client.channels.cache.get(chanId);
  if (!chan) return;

  const data = storage.getAttendanceForPeriod(7);
  const staffRoleId = config.staffAttendance.staffRoleId;

  const entries = [];
  for (const [userId, info] of Object.entries(data)) {
    // تأكد إن العضو ستاف
    let isStaff = false;
    try {
      const g = guild || client.guilds.cache.get(chan.guildId);
      const m = g.members.cache.get(userId) || (await g.members.fetch(userId).catch(() => null));
      isStaff = m && m.roles.cache.has(staffRoleId);
    } catch { isStaff = false; }
    if (!isStaff) continue;
    entries.push({ userId, totalMs: info.totalMs, sessions: info.sessions });
  }

  entries.sort((a, b) => b.totalMs - a.totalMs);

  let lines = entries.length
    ? entries.map((e, i) => `${['🥇', '🥈', '🥉'][i] || `${i + 1}.`} <@${e.userId}> — **${formatMinutes(e.totalMs)}** (${e.sessions} أيام)`).join('\n')
    : 'مفيش حضور مسجل هذا الأسبوع.';

  const embed = new EmbedBuilder()
    .setTitle('📋 تقرير حضور الستاف الأسبوعي')
    .setDescription(lines)
    .setColor(0x3498db)
    .setFooter({ text: 'آخر 7 أيام' })
    .setTimestamp();

  const msg = await chan.send({ embeds: [embed] }).catch(() => null);

  // تأكد إن الستاف الموجودين محسوبين حتى لو من غير أيام حاضرة
  try {
    const g = guild || client.guilds.cache.get(chan.guildId);
    const staffList = g.members.cache.filter((m) => m.roles.cache.has(staffRoleId));
    const missing = staffList.filter((m) => !data[m.id]).map((m) => `<@${m.id}>`);
    if (missing.length) {
      chan.send({ content: `ℹ️ ستاف **من غير حضور** هذا الأسبوع:\n${missing.join(' ')}` }).catch(() => {});
    }
  } catch {}

  return msg;
}

module.exports = { sendWeeklyReport, formatMinutes };