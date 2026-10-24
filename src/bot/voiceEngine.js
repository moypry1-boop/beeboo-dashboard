// ══════════════════════════════════════════════════════════════════════════════
//  BEEBOO VOICE ENGINE — Gateway & Voice Channel Keep-Alive Controller
//  Maintains all 9 Discord Bots in their designated voice channels 24/7
// ══════════════════════════════════════════════════════════════════════════════
const storage = require('../storage');
const pool = require('./pool');
const voiceStay = require('./features/voiceStay');
const { VoiceConnectionStatus } = require('@discordjs/voice');

// تعيينات القنوات الصوتية الثابتة للـ 9 بوتات
const VOICE_MAP = {
  '1536510357370314812': { channelId: '1536635011162308638', name: "╭・🌴・𝐉𝐮𝐥𝐚𝐢𝐚'𝐚" },
  '1536518247950590032': { channelId: '1536589886889529465', name: '┆・🌅・𝐐𝐨𝐫𝐭𝐮𝐛𝐚' },
  '1536553370502832178': { channelId: '1536589881055117434', name: '┆・🌊・𝐀𝐥 𝐀𝐝𝐚𝐧' },
  '1536612024208068608': { channelId: '1536589878106787920', name: '┆・⛵・𝐑𝐮𝐦𝐚𝐢𝐭𝐡𝐢𝐲𝐚' },
  '1536612088770994176': { channelId: '1536589890299502733', name: '┆・🐚・𝐀𝐥 𝐁𝐢𝐝𝐝𝐚' },
  '1536612140872368248': { channelId: '1536589893000499291', name: '┆・🪸・𝐀𝐥 𝐒𝐮𝐫𝐫𝐚' },
  '1536612213245354094': { channelId: '1536589896700002366', name: '┆・🦐・𝐀𝐥 𝐤𝐡𝐢𝐫𝐚𝐧' },
  '1536612272493953084': { channelId: '1536589899631960134', name: '┆・🐠・𝐁𝐧𝐚𝐢𝐝𝐞𝐫' },
  '1536612331654742128': { channelId: '1536589903301840996', name: '╰・🏖️・𝐁𝐚𝐲𝐚𝐧' },
};

let isVerifying = false;

/**
 * يفحص جميع البوتات الـ 9 ويتأكد من اتصالها بالـ Gateway والجلوس في الرومات الصوتية
 */
async function verifyAndKeepAlivePool() {
  if (isVerifying) {
    return { status: 'in_progress', message: 'Verification already running' };
  }
  isVerifying = true;
  const results = [];

  try {
    const bots = storage.getBots();
    let index = 1;

    for (const b of bots) {
      const botId = b.id;
      const targetConfig = VOICE_MAP[botId];
      const targetChannelId = targetConfig?.channelId;
      const channelLabel = targetConfig?.name || targetChannelId || 'Voice Channel';

      let client = pool.get(botId);
      if (!client || !client.isReady()) {
        try {
          console.log(`[KEEP-ALIVE] جارٍ تشغيل بوت ${index} (${b.label})...`);
          client = await pool.launch(b);
          await new Promise((r) => setTimeout(r, 1200));
        } catch (e) {
          console.error(`[KEEP-ALIVE] 🔴 تعذر تشغيل بوت ${index} (${b.label}):`, e.message);
          results.push({
            botNumber: index,
            id: botId,
            label: b.label,
            online: false,
            error: e.message,
          });
          index++;
          continue;
        }
      }

      const tag = client.user?.tag || b.label;
      const guilds = Array.from(client.guilds.cache.values());

      if (guilds.length === 0) {
        results.push({
          botNumber: index,
          id: botId,
          label: b.label,
          tag,
          online: true,
          inGuild: false,
          voiceStatus: 'no_guild',
        });
        index++;
        continue;
      }

      let voiceStatus = 'not_in_voice';
      let foundGuildName = null;
      let foundChannelName = channelLabel;

      for (const guild of guilds) {
        try {
          let ch = guild.channels.cache.get(targetChannelId);
          if (!ch) {
            ch = await guild.channels.fetch(targetChannelId).catch(() => null);
          }

          if (ch && (ch.isVoiceBased ? ch.isVoiceBased() : ch.type === 2)) {
            foundGuildName = guild.name;
            foundChannelName = ch.name;
            const me = guild.members.me;
            const inVoice = me?.voice?.channelId === ch.id;
            const connReady = client._voiceConn && client._voiceConn.state?.status === VoiceConnectionStatus.Ready;

            if (inVoice && connReady) {
              voiceStatus = 'connected_ready';
              break;
            } else {
              storage.updateGuild(botId, guild.id, (g) => {
                g.voiceStay.enabled = true;
                g.voiceStay.channelId = ch.id;
              });
              await voiceStay.joinIfEnabled(client, botId, guild);
              voiceStatus = 'rejoined';
              break;
            }
          }
        } catch (err) {
          console.warn(`[KEEP-ALIVE] خطأ فحص صوت البوت ${index}: ${err.message}`);
        }
      }

      results.push({
        botNumber: index,
        id: botId,
        label: b.label,
        tag,
        online: true,
        inGuild: true,
        guild: foundGuildName || guilds[0].name,
        channel: foundChannelName,
        voiceStatus,
      });

      index++;
    }
  } catch (err) {
    console.error('[VOICE ENGINE] خطأ شامل:', err.message);
  } finally {
    isVerifying = false;
  }

  return results;
}

module.exports = {
  VOICE_MAP,
  verifyAndKeepAlivePool,
};
