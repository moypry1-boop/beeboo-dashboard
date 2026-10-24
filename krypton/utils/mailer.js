// ═══════════════════════════════════════════════
//  Mailer Utility - إرسال إيميلات عبر Gmail (nodemailer)
// ═══════════════════════════════════════════════

const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.gmail.user,
      pass: (config.gmail.appPassword || '').replace(/\s+/g, ''), // شيل المسافات
    },
  });
  return transporter;
}

/**
 * إرسال إيميل
 * @param {Object} opts - { to, subject, html, text }
 */
async function sendMail(opts) {
  const user = config.gmail.user;
  const fromName = config.gmail.fromName || 'KRYPTON';

  const mailOptions = {
    from: `"${fromName}" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    replyTo: config.gmail.replyTo || user,
    html: opts.html || opts.text || '',
    text: opts.text || (opts.html ? opts.html.replace(/<[^>]*>/g, ' ') : ''),
  };

  const transport = getTransporter();
  return transport.sendMail(mailOptions);
}

// ═══════════════════════════════════════════════
//  قالب فاتورة — تصميم أنيق ونظيف (يدعم اللغة والعملة)
//  opts: { customerName, items, total, invoiceId, date, note, currency, lang }
// ═══════════════════════════════════════════════

// ─── لوحة الألوان — التصميم الأنيق النهائي (المعتمد) ───
const THEME = {
  brand: '#0f3460',   // اللون الرئيسي (أزرق ملكي)
  dark: '#1b2631',    // الغامق للنصوص
  muted: '#7f8c8d',   // الرمادي للنصوص الثانوية
  line: '#e5e9f0',    // الخطوط الفاتحة
  soft: '#f7f9fc',    // خلفية الخانات الفاتحة
};

function buildReceipt(opts) {
  const { customerName, items, total, invoiceId, date, note } = opts;
  const currency = opts.currency || '$';
  const lang = (opts.lang || 'ar') === 'en' ? 'en' : 'ar';

  const T = {
    ar: {
      dir: 'rtl',
      badge: 'فاتورة',
      billedTo: 'بيانات العميل',
      date: 'التاريخ',
      product: 'المنتج',
      qty: 'الكمية',
      price: 'السعر',
      lineTotal: 'الإجمالي',
      grandTotal: 'الإجمالي',
      thanks: `شكراً لتعاملك مع ${config.gmail.fromName || 'KRYPTON'}`,
      defaultName: 'عميل كريم',
      currencyBefore: false,
    },
    en: {
      dir: 'ltr',
      badge: 'INVOICE',
      billedTo: 'BILLED TO',
      date: 'DATE',
      product: 'PRODUCT',
      qty: 'QTY',
      price: 'PRICE',
      lineTotal: 'TOTAL',
      grandTotal: 'GRAND TOTAL',
      thanks: `Thank you for trusting ${config.gmail.fromName || 'KRYPTON'}`,
      defaultName: 'Dear Customer',
      currencyBefore: true,
    },
  }[lang];

  const fmt = (n) => {
    const num = n.toFixed(2);
    return T.currencyBefore ? `${currency}${num}` : `${num} ${currency}`;
  };

  const dirAttr = T.dir;

  // صفوف الجدول
  const rows = (items || [])
    .map(
      (it, i) =>
        `<tr>` +
        `<td style="padding:13px 6px;border-bottom:1px solid ${THEME.line};font-size:14px;color:${THEME.dark}">${it.name}</td>` +
        `<td style="padding:13px 6px;border-bottom:1px solid ${THEME.line};text-align:center;font-size:14px;color:${THEME.muted}">${it.qty}</td>` +
        `<td style="padding:13px 6px;border-bottom:1px solid ${THEME.line};text-align:right;font-size:14px;color:${THEME.dark}">${fmt(it.price)}</td>` +
        `<td style="padding:13px 6px;border-bottom:1px solid ${THEME.line};text-align:right;font-size:14px;color:${THEME.dark};font-weight:600">${fmt(it.qty * it.price)}</td>` +
        `</tr>`
    )
    .join('');

  const noRows =
    `<tr><td colspan="4" style="padding:20px;text-align:center;color:${THEME.muted};font-size:14px">—</td></tr>`;

  const invNo = invoiceId || `KRYPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-4)}`;
  const dateStr =
    date ||
    (lang === 'en'
      ? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }));

  // ترتيب الترويسة القلب حسب اللغة
  const headerRight = lang === 'en'
    ? `<div style="color:#ffffff;opacity:.75;font-size:11px;letter-spacing:2px">${T.badge}</div><div style="color:#ffffff;font-size:15px;font-weight:600;letter-spacing:.5px;margin-top:3px">${invNo}</div>`
    : `<div style="font-size:15px;font-weight:700;color:#ffffff">${config.gmail.fromName || 'KRYPTON'}</div>`;

  const headerLeft = lang === 'en'
    ? `<div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:1px">${config.gmail.fromName || 'KRYPTON'}</div>`
    : `<div style="color:#ffffff;opacity:.75;font-size:11px;letter-spacing:2px">فاتورة</div><div style="color:#ffffff;font-size:15px;font-weight:600;margin-top:3px">${invNo}</div>`;

  return {
    subject:
      (lang === 'en'
        ? `Invoice from ${config.gmail.fromName || 'KRYPTON'} — ${invNo}`
        : `فاتورة من ${config.gmail.fromName || 'KRYPTON'} — ${invNo}`),
    html:
      `<div dir="${dirAttr}" style="font-family:Arial,Helvetica,sans-serif;background:${THEME.soft};margin:0;padding:28px 12px">` +
      `<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 3px 12px rgba(15,52,96,0.10)">` +

      // ── الترويسة (بسيطة) ──
      `<div style="background:${THEME.brand};padding:24px 32px">` +
      `<table style="width:100%;border-collapse:collapse"><tr>` +
      `<td style="width:70%;text-align:${lang === 'en' ? 'left' : 'right'};vertical-align:middle">${headerRight}</td>` +
      `<td style="width:30%;text-align:${lang === 'en' ? 'right' : 'left'};vertical-align:middle">${headerLeft}</td>` +
      `</tr></table>` +
      `</div>` +

      // ── بيانات العميل ──
      `<div style="padding:26px 32px 6px">` +
      `<table style="width:100%;border-collapse:collapse"><tr>` +
      `<td style="vertical-align:top;width:50%">` +
      `<div style="font-size:11px;letter-spacing:1.5px;color:${THEME.muted};margin-bottom:5px">${T.billedTo}</div>` +
      `<div style="font-size:15px;font-weight:700;color:${THEME.dark}">${customerName || T.defaultName}</div>` +
      `</td>` +
      `<td style="vertical-align:top;width:50%;text-align:${lang === 'en' ? 'right' : 'left'}">` +
      `<div style="font-size:11px;letter-spacing:1.5px;color:${THEME.muted};margin-bottom:5px">${T.date}</div>` +
      `<div style="font-size:14px;color:${THEME.dark}">${dateStr}</div>` +
      `</td>` +
      `</tr></table>` +
      `</div>` +

      // ── خط فاصل ──
      `<div style="margin:18px 32px 0;height:1px;background:${THEME.line}"></div>` +

      // ── جدول المنتجات (رأس بسيط) ──
      `<div style="padding:12px 32px 0">` +
      `<table style="width:100%;border-collapse:collapse">` +
      `<tr>` +
      `<th style="padding:8px;text-align:right;font-size:11px;letter-spacing:1px;color:${THEME.muted};text-transform:uppercase">${T.product}</th>` +
      `<th style="padding:8px;text-align:center;font-size:11px;letter-spacing:1px;color:${THEME.muted};text-transform:uppercase">${T.qty}</th>` +
      `<th style="padding:8px;text-align:right;font-size:11px;letter-spacing:1px;color:${THEME.muted};text-transform:uppercase">${T.price}</th>` +
      `<th style="padding:8px;text-align:right;font-size:11px;letter-spacing:1px;color:${THEME.muted};text-transform:uppercase">${T.lineTotal}</th>` +
      `</tr>` +
      (items && items.length ? rows : noRows) +
      `</table>` +
      `</div>` +

      // ── الإجمالي (بسيط بخط علوي) ──
      `<div style="margin:18px 32px 0;padding:6px 0;border-top:2px solid ${THEME.line}">` +
      `<table style="width:100%;border-collapse:collapse"><tr>` +
      `<td style="text-align:right;"><span style="font-size:15px;font-weight:700;color:${THEME.muted}">${T.grandTotal}</span></td>` +
      `<td style="text-align:left;"><span style="font-size:22px;font-weight:800;color:${THEME.brand}">${fmt(total)}</span></td>` +
      `</tr></table>` +
      `</div>` +

      // ── ملاحظة ──
      (note
        ? `<div style="margin:14px 32px 0;padding:0;color:${THEME.muted};font-size:13px"><span style="font-weight:600;color:${THEME.dark}">${lang === 'en' ? 'Note:' : 'ملاحظة:'}</span> ${note}</div>`
        : '') +

      // ── تذييل ──
      `<div style="margin-top:26px;padding:18px 32px;background:${THEME.soft};text-align:center">` +
      `<div style="font-size:14px;color:${THEME.dark};font-weight:600">${T.thanks}</div>` +
      (config.gmail.signature ? `<div style="margin-top:6px;font-size:12px;color:${THEME.muted}">${config.gmail.signature.replace(/<br>/g, ' ')}</div>` : '') +
      `</div>` +

      `</div></div>`,
  };
}

module.exports = { sendMail, buildReceipt };
