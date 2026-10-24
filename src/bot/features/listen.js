// التقاط صوت الروم وتحويله للويب سوكيت
const { getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
const prism = require('prism-media');

const activeListeners = new Map();

function listenerKey(botId, guildId) { return `${botId}_${guildId}`; }

// نجيب الاتصال الصوتي — نجرب كل المصادر
function findConnection(client, guildId) {
  // 1) من voiceStay — client._voiceConn
  if (client._voiceConn && client._voiceConn.state?.status !== VoiceConnectionStatus.Destroyed) {
    return client._voiceConn;
  }

  // 2) من guild.members.me.voice.connection
  const me = client.guilds.cache.get(guildId)?.members?.me;
  if (me?.voice?.connection) return me.voice.connection;

  // 3) من DisTube voices manager
  try {
    const dt = require('./music').dt(client);
    const dv = dt.voices.get(guildId);
    if (dv?.connection) return dv.connection;
  } catch {}

  // 4) من @discordjs/voice مباشرة
  try {
    const conn = getVoiceConnection(guildId);
    if (conn && conn.state?.status !== VoiceConnectionStatus.Destroyed) return conn;
  } catch {}

  return null;
}

function startCapture(client, botId, guildId, onAudio) {
  const conn = findConnection(client, guildId);
  if (!conn) {
    console.error(`[LISTEN] No voice connection found for guild ${guildId}`);
    throw new Error('البوت مش في روم صوتية — اتأكد البوت متصل بصوت');
  }

  const receiver = conn.receiver;
  if (!receiver) {
    console.error(`[LISTEN] receiver is null for guild ${guildId}, conn state: ${conn.state?.status}`);
    throw new Error('الاتصال الصوتي لسه بيتثبت — جرب تاني بعد ثانية');
  }

  const key = listenerKey(botId, guildId);
  const subs = [];
  const decoders = new Map();

  // نسجّل اشتراك لكل مستخدم مرة واحدة فقط — وعمرنا ما نفسخه في 'end'
  // لأن الفسخ/الاشتراك في كل مرة بيضيّع أول جزء من الكلام (تقطيع)
  function ensureListener(userId) {
    if (decoders.has(userId)) return;
    try {
      const opusStream = receiver.subscribe(userId, { end: { behavior: 0 } });
      const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
      opusStream.pipe(decoder);

      decoder.on('data', (pcmChunk) => {
        const header = Buffer.alloc(4);
        // لازم >>> 0 عشان نحول الرقم لـ unsigned 32-bit
        header.writeUInt32LE(Number(userId) >>> 0, 0);
        try { onAudio(Buffer.concat([header, pcmChunk])); } catch {}
      });

      decoder.on('error', (e) => { if (process.env.LISTEN_DEBUG) console.error(`[LISTEN] decoder err:`, e.message); });
      opusStream.on('error', (e) => { if (process.env.LISTEN_DEBUG) console.error(`[LISTEN] opus err:`, e.message); });

      subs.push(opusStream);
      decoders.set(userId, { opusStream, decoder });
    } catch (e) {
      if (process.env.LISTEN_DEBUG) console.error(`[LISTEN] subscribe err:`, e.message);
    }
  }

  receiver.speaking.on('start', (userId) => {
    if (process.env.LISTEN_DEBUG) console.log(`[LISTEN] User ${userId} started speaking in guild ${guildId}`);
    ensureListener(userId);
  });

  receiver.speaking.on('end', (userId) => {
    // ما نفسخش الاشتراك هنا — مستمر عشان الصوت ما يقطعش أول ما يبدأ الكلام.
    // الـ cleanup بيحصل كله مرة واحدة في stopCapture
  });

  console.log(`[LISTEN] Capture started for guild ${guildId} (conn state: ${conn.state?.status})`);

  const cleanup = () => {
    for (const [, entry] of decoders) {
      entry.opusStream.destroy();
      entry.decoder.destroy();
    }
    decoders.clear();
    subs.forEach((s) => { try { s.destroy(); } catch {} });
    subs.length = 0;
    activeListeners.delete(key);
    console.log(`[LISTEN] Capture stopped for guild ${guildId}`);
  };

  activeListeners.set(key, { subs, decoders, cleanup, client });
  return cleanup;
}

function stopCapture(botId, guildId) {
  const entry = activeListeners.get(listenerKey(botId, guildId));
  if (entry) entry.cleanup();
}

function isCapturing(botId, guildId) {
  return activeListeners.has(listenerKey(botId, guildId));
}

module.exports = { startCapture, stopCapture, isCapturing, activeListeners };
