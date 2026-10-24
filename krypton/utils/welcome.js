// ═══════════════════════════════════════════════
//  Welcome Card Utility - بطاقة ترحيب KRYPTON (Card فخم، ألوان مظبوطة)
//  لوحة/card أنيقة + لوجو + بروفايل + نصوص واضحة
// ═══════════════════════════════════════════════

let Canvas, loadImage;
try {
  Canvas = require('@napi-rs/canvas');
  loadImage = Canvas.loadImage;
} catch {
  module.exports = { generateWelcomeCard: async () => null };
  return;
}

const { AttachmentBuilder } = require('discord.js');
const path = require('path');

// ─── لوحة ألوان KRYPTON المظبوطة (نافي/فضي/سماوي) ───
const BG_TOP = '#0e1a26';       // خلفية داكنة مزرق ناعم
const BG_BOTTOM = '#070d14';    // أغمق
const CARD_BG = 'rgba(15,26,38,0.72)';   // خلفية اللوحة
const CARD_BORDER = '#2a4052';  // حدود اللوحة
const CYAN = '#29B9F2';
const CYAN_BRIGHT = '#63D9FF';
const STEEL = '#17618A';
const TEXT = '#f2f7fb';
const MUTED = '#9fb4c4';
const SILVER = '#c7d3dd';

async function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function generateWelcomeCard(member) {
  const W = 1280, H = 720;
  const canvas = Canvas.createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ─── 1) الخلفية (تدريج داكن ناعم رصين) ───
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, BG_TOP);
  bg.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // تظليل ناعم في الأطراف (عمق خفيف بدون زخرفة)
  const glow = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 700);
  glow.addColorStop(0, 'rgba(41,185,242,0.05)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ─── 2) اللوح (Card) في النص ───
  const cardW = 760, cardH = 520, cardX = (W - cardW) / 2, cardY = 100, cardR = 26;

  // ظل ناعم تحت اللوحة
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 10;
  await roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = CARD_BG;
  ctx.fill();
  ctx.restore();

  // حدود رفيعة لامعة (قمة وحد سفلي سماوي)
  await roundRect(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 2;
  ctx.stroke();

  // شريط سفلي سماوي داخل اللوحة
  ctx.fillStyle = CYAN;
  await roundRect(ctx, cardX, cardY + cardH - 8, cardW, 8, 0);
  ctx.fill();

  // ─── 3) اللوجو (صغير، فوق البروفايل داخل اللوحة) ───
  try {
    const logo = await loadImage(path.join(__dirname, '..', 'assets', 'krypton-logo.png'));
    const logoSize = 92;
    const ratio = logo.width / logo.height;
    const lw = logoSize * (ratio > 1 ? 1 : ratio);
    const lh = logoSize * (ratio > 1 ? 1 / ratio : 1);
    ctx.drawImage(logo, W / 2 - lw / 2, cardY + 34, lw, lh);
  } catch {}

  // ─── 4) صورة البروفايل (دائرة داخل اللوحة) ───
  const avX = W / 2 - 95, avY = cardY + 115, avSize = 190;
  try {
    const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512 }));
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, avX, avY, avSize, avSize);
    ctx.restore();

    // حلقة حول البروفايل (سماوي)
    ctx.beginPath();
    ctx.arc(W / 2, avY + avSize / 2, avSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = CYAN_BRIGHT;
    ctx.lineWidth = 4;
    ctx.stroke();
  } catch {}

  // ─── 5) النصوص داخل اللوحة ───
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // "Welcome to"
  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = '600 32px Segoe UI';
  ctx.fillText('🎉 Welcome to', W / 2, 440);

  // اسم المتجر
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 60px Segoe UI';
  ctx.fillText('KRYPTON', W / 2, 500);

  // اسم العضو (سماوي فاتح)
  const name = member.user.username || 'User';
  ctx.fillStyle = SILVER;
  ctx.font = '30px Segoe UI';
  ctx.fillText(name, W / 2, 556);

  // عدد الأعضاء (محتوى سفلي)
  ctx.fillStyle = MUTED;
  ctx.font = '22px Segoe UI';
  ctx.fillText(`👥 العضو رقم ${member.guild.memberCount}`, W / 2, 612);

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: `welcome-${member.id}.png` });
}

module.exports = { generateWelcomeCard };
