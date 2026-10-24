// ═══════════════════════════════════════════════
//  Downloads Utility - تحويل المحتوى من الشات لملف منسّق
//  الصيغة المدخلة في الروم:
//    title: اسم المنتج
//    desc: وصف المنتج
//    content:
//    ... المحتوى/الأكواد هنا ...
//  أو content بس، أو مجرد كود/نص.
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const config = require('../config');
const { logger } = require('./logger');

const DL_DIR = path.join(__dirname, '..', 'assets', 'downloads');

function ensureDir() {
  if (!fs.existsSync(DL_DIR)) fs.mkdirSync(DL_DIR, { recursive: true });
}

// ─── تحليل رسالة المستخدم ───
function parseMessage(content) {
  const lines = content.split(/\r?\n/);
  let title = null;
  let desc = '';
  let format = null;
  let contentLines = [];

  // استخراج المفاتيح والـ content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const titleMatch = line.match(/^title\s*[:=]\s*(.+)/i);
    const descMatch = line.match(/^desc\s*[:=]\s*(.+)/i);
    const fmtMatch = line.match(/^format\s*[:=]\s*(html|json|txt)/i);

    if (titleMatch) { title = titleMatch[1].trim(); continue; }
    if (descMatch) { desc = descMatch[1].trim(); continue; }
    if (fmtMatch) { format = fmtMatch[1].toLowerCase(); continue; }

    // عند أول سطر "content:" نبدأ جمع باقي الأسطر كله كمحتوى
    if (/^content\s*[:=]/i.test(line)) {
      contentLines = lines.slice(i + 1);
      break;
    }

    // لو عمر علامة content ظهرت، خبط هذه الأسطر في المحتوى
    contentLines.push(line);
  }

  // شيل الأسطر الفارغة الزائدة من البداية
  while (contentLines.length && contentLines[0].trim() === '') contentLines.shift();
  // شيل الخط الأخير "=====" أو "—" 
  while (contentLines.length && /^[=\-—_#*]{4,}$/.test(contentLines[contentLines.length - 1].trim())) {
    contentLines.pop();
  }

  const body = contentLines.join('\n');

  return { title, desc, format, body };
}

// ─── تلوين بسيط للأكواد داخل HTML ───
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function codeBlockToHtml(body) {
  // يدعم بلوكات أكواد ```lang ... ``` وتحويلها لمقتطفات
  const blocks = body.split(/```/);
  for (let i = 1; i < blocks.length; i += 2) {
    const block = blocks[i];
    const nl = block.indexOf('\n');
    const lang = nl >= 0 ? block.slice(0, nl).trim() : '';
    const code = nl >= 0 ? block.slice(nl + 1) : block;
    blocks[i] = `<pre class="code"><span class="lang">${escapeHtml(lang || 'code')}</span>\n${escapeHtml(code)}</pre>`;
  }
  return blocks.join('');
}

// ─── بناء HTML أنيق ───
function buildHtml(data) {
  const title = escapeHtml(data.title || 'Untitled');
  const desc = escapeHtml(data.desc || '');
  const bodyHtml = codeBlockToHtml(data.body || '');
  const generated = new Date().toLocaleString('en-GB');
  const meta = escapeHtml(JSON.stringify({ title: data.title || '', desc: data.desc || '', generated }, null, 2));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - KRYPTON</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #061A2D;
    color: #DDEBF3;
    line-height: 1.6;
    padding: 40px 20px;
  }
  .card {
    max-width: 860px;
    margin: 0 auto;
    background: #0A3150;
    border-radius: 18px;
    border: 1px solid #29B9F2;
    box-shadow: 0 12px 40px rgba(0,0,0,.4);
    overflow: hidden;
  }
  .header {
    background: linear-gradient(135deg, #0A3150, #061A2D);
    padding: 28px 32px;
    border-bottom: 2px solid #29B9F2;
  }
  .header h1 { color: #63D9FF; font-size: 28px; letter-spacing: .5px; }
  .header .sub { color: #AFC4D2; margin-top: 8px; font-size: 14px; }
  .badge {
    display: inline-block; background: #29B9F2; color: #061A2D;
    padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
    margin-top: 14px; letter-spacing: 1px;
  }
  .body { padding: 28px 32px; }
  .desc {
    color: #DDEBF3; font-size: 15px; margin-bottom: 22px; background: #061A2D;
    padding: 14px 16px; border-radius: 10px; border-left: 4px solid #63D9FF;
  }
  pre.code {
    background: #061A2D; border: 1px solid #29B9F2; border-radius: 10px;
    padding: 18px; overflow-x: auto; margin-bottom: 18px;
    font-family: 'Consolas', 'Courier New', monospace; font-size: 13px;
    color: #F5FBFF; white-space: pre-wrap; word-break: break-word;
  }
  pre.code .lang {
    color: #63D9FF; font-weight: 700; display: block; margin-bottom: 8px;
    font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
  }
  .plain {
    background: #061A2D; border: 1px solid #29B9F2; border-radius: 10px;
    padding: 18px; white-space: pre-wrap; word-break: break-word;
    font-family: 'Consolas', monospace; font-size: 13px; color: #F5FBFF;
  }
  .footer {
    padding: 16px 32px; background: #061A2D; border-top: 1px solid #29B9F2;
    display: flex; justify-content: space-between; align-items: center;
    color: #71889A; font-size: 12px;
  }
  .footer .brand { color: #29B9F2; font-weight: 700; letter-spacing: 2px; }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>📦 ${title}</h1>
      ${desc ? `<div class="sub">${desc}</div>` : ''}
      <span class="badge">KRYPTON STORE</span>
    </div>
    <div class="body">
      ${bodyHtml ? bodyHtml : '<div class="plain">(لا يوجد محتوى)</div>'}
    </div>
    <div class="footer">
      <span>Generated: ${escapeHtml(generated)}</span>
      <span class="brand">ＫＲＹＰＴＯＮ</span>
    </div>
  </div>
  <!-- META:
${meta}
-->
</body>
</html>`;
}

// ─── إنشاء الملف من الرسالة ───
async function createFileFromContent(content) {
  ensureDir();
  const parsed = parseMessage(content);
  const format = parsed.format || config.downloads.defaultFormat || 'html';
  const title = parsed.title || 'download-' + Date.now();
  const safeTitle = title.replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '_');

  let filename, filebuffer;

  if (format === 'json') {
    const json = { title: parsed.title || 'Untitled', desc: parsed.desc || '', content: parsed.body || '' };
    filename = `${safeTitle || 'download'}.json`;
    filebuffer = Buffer.from(JSON.stringify(json, null, 2));
  } else if (format === 'txt') {
    filename = `${safeTitle || 'download'}.txt`;
    filebuffer = Buffer.from(parsed.body || '', 'utf8');
  } else {
    filename = `${safeTitle || 'download'}.html`;
    filebuffer = Buffer.from(buildHtml(parsed), 'utf8');
  }

  // احفظ في مجلد مؤقت على القرص لحتى نرفعه كملف
  const filePath = path.join(DL_DIR, filename);
  fs.writeFileSync(filePath, filebuffer);

  return { filename, filePath, filebuffer, parsed, format };
}

// ─── هل الرسالة تصلح للتحويل؟ ───
function shouldProcess(content, authorIsStaff) {
  if (!content || !content.trim()) return false;
  // لسه هقصرها على روم مخصوص والعضو اللي بعتها — التحويل فقط من روم الـ downloads
  return true;
}

// ─── إنشاء روم downloads تلقائيًا ───
async function ensureDownloadsChannel(guild) {
  const cfg = config.downloads || {};
  if (cfg.channelId && guild.channels.cache.has(cfg.channelId)) {
    return guild.channels.cache.get(cfg.channelId);
  }
  if (cfg.autoCreateChannel === false) return null;

  // جيب رات أولًا؟ نبحث عن روم به نفس الاسم
  let found = [...guild.channels.cache.values()].find(
    (c) => c.type === 0 && c.name.toLowerCase().includes('download')
  );
  if (found) {
    config.downloads.channelId = found.id;
    return found;
  }

  try {
    const created = await guild.channels.create({
      name: '📥 downloads',
      type: 0, // GuildText
      topic: 'اكتب محتوى فيه title / desc / content والبوط بأنزّله لك كملف',
    });
    // نتذكّره في storage حتى لو تتغير config
    const storage = require('./storage');
    storage.setRaw({ downloadsChannelId: created.id });
    return created;
  } catch (e) {
    console.error('[Downloads] cannot create channel:', e.message);
    return null;
  }
}

function getDownloadsChannelId(guild) {
  const storage = require('./storage');
  const raw = storage.getRaw ? storage.getRaw() : {};
  return raw.downloadsChannelId || config.downloads.channelId || null;
}

module.exports = {
  parseMessage,
  createFileFromContent,
  shouldProcess,
  ensureDownloadsChannel,
  getDownloadsChannelId,
  buildHtml,
};
