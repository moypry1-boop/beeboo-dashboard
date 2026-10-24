// صورة الترحيب — Canvas
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

async function renderWelcome(member, cfg) {
  const W = 900, H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // خلفية متدرجة
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, cfg.bgColor1 || '#8b5cf6');
  grad.addColorStop(1, cfg.bgColor2 || '#4c1d95');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // دوائر زخرفية شفافة
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(W - 60, 40, 120, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, H - 30, 90, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // الأفاتار داخل دايرة
  const AX = W / 2 - 100, AY = 55, AR = 95;
  ctx.save();
  ctx.beginPath();
  ctx.arc(AX + AR, AY + AR, AR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    const url = member.user.displayAvatarURL({ extension: 'png', size: 256 });
    const img = await loadImage(url);
    ctx.drawImage(img, AX, AY, AR * 2, AR * 2);
  } catch { /* أفاتار فاشل — نسيب الخلفية */ }
  ctx.restore();

  // إطار الأفاتار
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(AX + AR, AY + AR, AR, 0, Math.PI * 2);
  ctx.stroke();

  // النصوص
  ctx.textAlign = 'center';
  ctx.fillStyle = cfg.textColor || '#ffffff';

  ctx.font = 'bold 46px sans-serif';
  ctx.fillText('WELCOME', W / 2, H - 62);

  ctx.font = '28px sans-serif';
  ctx.globalAlpha = 0.9;
  ctx.fillText(`${member.user.username} • عضو #${member.guild.memberCount}`, W / 2, H - 24);
  ctx.globalAlpha = 1;

  return canvas.toBuffer('image/png');
}

module.exports = { renderWelcome };
