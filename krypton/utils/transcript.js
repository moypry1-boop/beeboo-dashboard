// ═══════════════════════════════════════════════
//  Transcript Utility - أرشفة التيكت HTML
// ═══════════════════════════════════════════════

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateTranscript(channel, messages, client) {
  const messageList = messages
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    .map(m => {
      const time = m.createdAt.toISOString();
      const author = m.author.tag;
      const avatar = m.author.displayAvatarURL({ dynamic: true, size: 32 });
      const content = m.content ? escapeHtml(m.content) : '';
      const attachments = m.attachments.size > 0
        ? m.attachments.map(a => `[📎 ${a.name}](${a.url})`).join(' ')
        : '';
      const embeds = m.embeds.length > 0
        ? `<div style="margin:4px 0;padding:8px;background:#2f3136;border-left:4px solid #5865f2;border-radius:4px;"><em>[Embed]</em> ${m.embeds.map(e => escapeHtml(e.title || '') + ' ' + escapeHtml(e.description || '')).join(' ')}</div>`
        : '';
      return `
      <div style="margin:4px 0;display:flex;gap:12px;">
        <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;flex-shrink:0;" />
        <div>
          <strong>${escapeHtml(author)}</strong>
          <span style="color:#72767d;margin-left:8px;font-size:12px;">${time}</span>
          <div style="color:#dcddde;">${content}${attachments ? '<br>' + attachments : ''}</div>
          ${embeds}
        </div>
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<title>Transcript - ${escapeHtml(channel.name)}</title>
<style>
  body { background:#1a1a2e; color:#e0e0e0; font-family:'Segoe UI',Tahoma,sans-serif; padding:24px; }
  h1 { text-align:center; color:#5865f2; margin-bottom:24px; }
  .meta { text-align:center; color:#72767d; margin-bottom:24px; }
  .messages { max-width:800px; margin:0 auto; }
</style>
</head>
<body>
<h1>📋 Ticket Transcript: ${escapeHtml(channel.name)}</h1>
<div class="meta">
  Total messages: ${messages.length}<br/>
  Opened: ${channel.createdAt.toISOString()}<br/>
  Topic: ${escapeHtml(channel.topic || 'N/A')}<br/>
  Generated: ${new Date().toISOString()}
</div>
<div class="messages">${messageList || '<p>No messages.</p>'}</div>
</body>
</html>`;
}

module.exports = { generateTranscript };