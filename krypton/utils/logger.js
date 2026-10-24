// ═══════════════════════════════════════════════
//  Logger Utility - اللوجات (رومات أو ويبهوكات)
// ═══════════════════════════════════════════════

const {
  EmbedBuilder,
  WebhookClient,
} = require('discord.js');
const config = require('../config');

const COLORS = {
  info:    0x3498db,
  success: 0x2ecc71,
  warning: 0xf39c12,
  danger:  0xe74c3c,
  security:0xff0000,
  ticket:  0x9b59b6,
  verify:  0x1abc9c,
  mod:     0xe67e22,
};

// العميل - بيتحط من index.js
let client = null;

function setClient(c) {
  client = c;
}

function isValidUrl(url) {
  return typeof url === 'string' && url.startsWith('https://discord') && !url.includes('WEBHOOK_URL');
}

// ─── اختيار الهدف: ويبهوك لو متظبط، غير كده روم ───
function getTarget(type) {
  const id = config.ids;
  const map = {
    main:     { webhook: id.logWebhook,          channel: id.logChannel },
    ticket:   { webhook: id.ticketLogWebhook,    channel: id.ticketLogChannel },
    security: { webhook: id.securityLogWebhook,  channel: id.securityLogChannel },
  };

  const entry = map[type] || map.main;
  if (entry.webhook && isValidUrl(entry.webhook)) {
    return { kind: 'webhook', value: entry.webhook };
  }
  if (entry.channel && !entry.channel.includes('HERE')) {
    return { kind: 'channel', value: entry.channel };
  }
  return null;
}

async function sendLog(type, title, description, options = {}) {
  const target = getTarget(type);
  if (!target) {
    console.log(`[Logger] No target for ${type}: ${title}`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS[options.color] || COLORS.info)
    .setTimestamp();

  if (options.fields) {
    for (const field of options.fields) {
      embed.addFields({ name: field.name, value: field.value, inline: field.inline ?? true });
    }
  }

  if (options.footer) embed.setFooter({ text: options.footer });

  try {
    if (target.kind === 'webhook') {
      const webhook = new WebhookClient({ url: target.value });
      await webhook.send({
        embeds: [embed],
        username: 'KRYPTON Logs',
      });
    } else if (target.kind === 'channel' && client) {
      const channel = await client.channels.fetch(target.value).catch(() => null);
      if (channel && channel.isTextBased() && channel.permissionsFor(client.user.id).has('SendMessages')) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[Logger] Failed to send ${type} log:`, err.message);
  }
}

// ─── مستقبلات سريعة ───
const logger = {
  info:    (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'info' }),
  success: (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'success' }),
  warning: (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'warning' }),
  danger:  (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'danger' }),
  security:(title, desc, opts) => sendLog('security', title, desc, { ...opts, color: 'security' }),
  ticket:  (title, desc, opts) => sendLog('ticket', title, desc, { ...opts, color: 'ticket' }),
  verify:  (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'verify' }),
  mod:     (title, desc, opts) => sendLog('main', title, desc, { ...opts, color: 'mod' }),
};

module.exports = { logger, sendLog, COLORS, setClient };