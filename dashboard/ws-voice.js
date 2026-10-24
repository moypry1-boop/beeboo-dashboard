// WebSocket for live voice — استماع + مايك
const { WebSocketServer } = require('ws');
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, VoiceConnectionStatus, entersState, NoSubscriberBehavior } = require('@discordjs/voice');
const { Readable, PassThrough } = require('stream');
const prism = require('prism-media');
const pool = require('../src/bot/pool');
const listen = require('../src/bot/features/listen');

function parseCookies(header) {
  const map = {};
  if (!header) return map;
  header.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) map[k.trim()] = decodeURIComponent(v.join('=').trim());
  });
  return map;
}

// نجيب الاتصال الصوتي — لكل بوت اتصال مستقل (مفيش cache مشترك!)
function findConnection(client, clientBotId, guildId) {
  // 1) من voiceStay — client._voiceConn (الأولوية القصوى — خاص بكل بوت)
  if (client._voiceConn && client._voiceConn.state?.status !== VoiceConnectionStatus.Destroyed) {
    return client._voiceConn;
  }

  // 2) من guild.members.me.voice.connection
  try {
    const me = client.guilds.cache.get(guildId)?.members?.me;
    if (me?.voice?.connection) return me.voice.connection;
  } catch {}

  // 3) من DisTube voices manager
  try {
    const { dt } = require('../src/bot/features/music');
    const clientDt = dt(client);
    const dv = clientDt.voices.get(guildId);
    if (dv?.connection) return dv.connection;
  } catch {}

  // 4) من @discordjs/voice — نجرب بالـ group الخاص بالبوت الأول
  try {
    const { getVoiceConnection } = require('@discordjs/voice');
    const c = getVoiceConnection(guildId, clientBotId);
    if (c && c.state?.status !== VoiceConnectionStatus.Destroyed) return c;
    // لو مفيش، نجرب بدون group (احتياطي)
    const c2 = getVoiceConnection(guildId);
    if (c2 && c2.state?.status !== VoiceConnectionStatus.Destroyed) return c2;
  } catch {}

  return null;
}

function setup(server, sessionStore) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== '/ws/listen') return socket.destroy();

    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies['connect.sid'];
    if (!sid) return socket.destroy();

    const sidKey = sid.replace('s:', '').split('.')[0];
    sessionStore.get(sidKey, (err, sess) => {
      if (err || !sess) return socket.destroy();
      if (!sess.authUser || !sess.secretUnlocked) return socket.destroy();

      const botId = url.searchParams.get('botId');
      const guildId = url.searchParams.get('guildId');
      if (!botId || !guildId) return socket.destroy();

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._botId = botId;
        ws._guildId = guildId;
        wss.emit('connection', ws, req);
      });
    });
  });

  wss.on('connection', async (ws) => {
    const botId = ws._botId;
    const guildId = ws._guildId;

    const client = pool.get(botId);
    if (!client || !client.isReady()) {
      ws.send(JSON.stringify({ type: 'error', message: 'البوت مش شغال' }));
      ws.close(); return;
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      ws.send(JSON.stringify({ type: 'error', message: 'السيرفر مش موجود' }));
      ws.close(); return;
    }

    const conn = findConnection(client, botId, guildId);
    if (!conn) {
      ws.send(JSON.stringify({ type: 'error', message: 'البوت مش متصل بالروم الصوتية' }));
      ws.close(); return;
    }

    // استنى الاتصال يبقى Ready لو لسه signalling
    if (conn.state?.status !== VoiceConnectionStatus.Ready) {
      console.log('[WS-VOICE] Waiting for connection to be Ready (current:', conn.state?.status, ')');
      try {
        await entersState(conn, VoiceConnectionStatus.Ready, 15000);
        console.log('[WS-VOICE] Connection is Ready!');
      } catch (e) {
        console.error('[WS-VOICE] Connection failed to become Ready:', e.message);
        ws.send(JSON.stringify({ type: 'error', message: 'الاتصال الصوتي مش جاهز — جرب تاني' }));
        ws.close(); return;
      }
    }

    // إرسال معلومات الروم
    const me = guild.members.me;
    const inVoice = me?.voice?.channelId;
    if (inVoice) {
      const ch = guild.channels.cache.get(inVoice);
      if (ch && ch.isVoiceBased()) {
        const members = ch.members.map((m) => ({
          id: m.id,
          name: m.displayName,
          avatar: m.user.displayAvatarURL({ size: 32 }),
        }));
        ws.send(JSON.stringify({ type: 'channel', name: ch.name, members }));
      }
    }

    // === الاستماع: البوت يسمع الروم ويصوّر للويب ===
    let cleanupListen = null;
    try {
      cleanupListen = listen.startCapture(client, botId, guildId, (audioFrame) => {
        if (ws.readyState === 1) ws.send(audioFrame);
      });
    } catch (e) {
      console.error('[WS-VOICE] listen startCapture error:', e.message);
    }

    // === المايك: المتصفح يبعت صوت والبوت يسمع في الروم ===
    // نستخدم PassThrough كـ intermediate stream عشان نقدر نبعت بيانات بشكل مستمر
    const micPassthrough = new PassThrough();
    let micPlayer = null;
    let micSub = null;
    let micEncoder = null;
    let micResource = null;

    function startMicPipeline() {
      if (micPlayer) return; // شغال أصلاً

      try {
        // Opus encoder: PCM stereo 48kHz → opus frames
        micEncoder = new prism.opus.Encoder({ rate: 48000, channels: 2, frameSize: 960 });

        // الممر: micPassthrough → opus encoder → AudioResource
        micPassthrough.pipe(micEncoder);

        micResource = createAudioResource(micEncoder, { inputType: StreamType.Opus, inlineVolume: false });

        micPlayer = createAudioPlayer({
          behaviors: { noSubscriber: NoSubscriberBehavior.Play }, // يكمل يشتغل حتى لو مفيش subscriber
        });

        micSub = conn.subscribe(micPlayer);
        micPlayer.play(micResource);

        micPlayer.on(AudioPlayerStatus.Idle, () => {
          // الـ stream لسه شغال — نرجّع نشغّله
          if (micPlayer && micEncoder && !micEncoder.destroyed) {
            try {
              const newResource = createAudioResource(micEncoder, { inputType: StreamType.Opus });
              micPlayer.play(newResource);
            } catch (e) {
              console.error('[WS-VOICE] mic replay err:', e.message);
            }
          }
        });

        micPlayer.on('error', (e) => {
          console.error('[WS-VOICE] mic player error:', e.message);
          // نحاول نرجع نشغّل بعد ثانية
          setTimeout(() => {
            if (micPlayer && micEncoder && !micEncoder.destroyed) {
              try {
                const newResource = createAudioResource(micEncoder, { inputType: StreamType.Opus });
                micPlayer.play(newResource);
              } catch {}
            }
          }, 1000);
        });

        console.log('[WS-VOICE] Mic pipeline started');
        ws.send(JSON.stringify({ type: 'mic_started' }));
      } catch (e) {
        console.error('[WS-VOICE] startMicPipeline err:', e.message);
      }
    }

    function stopMicPipeline() {
      if (micPlayer) {
        try { micPlayer.stop(); } catch {}
        micPlayer = null;
      }
      if (micSub) {
        try { micSub.unsubscribe(); } catch {}
        micSub = null;
      }
      if (micEncoder) {
        try { micPassthrough.unpipe(micEncoder); } catch {}
        try { micEncoder.destroy(); } catch {}
        micEncoder = null;
      }
      // نفرّغ الـ pass-through
      try { micPassthrough.resume(); } catch {}
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'mic_stopped' }));
    }

    // استقبال بيانات من المتصفح
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // بيانات صوتية من المايك — PCM int16 stereo 48kHz
        if (!micPlayer) startMicPipeline();
        // ندفع الـ PCM في الـ PassThrough → opus encoder → AudioPlayer
        micPassthrough.write(Buffer.from(data));
      } else {
        // رسالة نصية — أوامر التحكم
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'mic_start') {
            startMicPipeline();
          } else if (msg.type === 'mic_stop') {
            stopMicPipeline();
          }
        } catch {}
      }
    });

    // تنظيف عند الإغلاق
    const cleanup = () => {
      if (cleanupListen) cleanupListen();
      stopMicPipeline();
      client.off('voiceStateUpdate', vcHandler);
      console.log(`[WS-VOICE] cleaned up for guild ${guildId}`);
    };

    // متابعة دخول/خروج الأعضاء
    const vcHandler = (old, cur) => {
      try {
        if (cur.member?.id === client.user.id) return;
        if (!ws || ws.readyState !== 1) return;
        if (cur.channelId === inVoice && old.channelId !== inVoice) {
          ws.send(JSON.stringify({ type: 'join', member: { id: cur.member.id, name: cur.member.displayName } }));
        }
        if (old.channelId === inVoice && cur.channelId !== inVoice) {
          ws.send(JSON.stringify({ type: 'leave', userId: old.member.id }));
        }
      } catch {}
    };
    client.on('voiceStateUpdate', vcHandler);

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return wss;
}

module.exports = { setup };
