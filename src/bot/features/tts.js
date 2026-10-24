// نطق بالصوت — Edge TTS (عربي طبيعي) + Google TTS كاحتياطي
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { PassThrough } = require('stream');
const https = require('https');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const VOICES = { female: 'ar-EG-SalmaNeural', male: 'ar-EG-ShakirNeural' };

// Google Translate TTS (احتياطي — صوت بسيط بس شغال دايمًا)
function googleTTS(text, lang = 'ar') {
  return new Promise((resolve, reject) => {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text)}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) return reject(new Error('Google TTS ' + res.statusCode));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Edge TTS (جودة عالية — صوت طبيعي)
async function edgeTTS(text, voice = 'female') {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICES[voice] || VOICES.female, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const result = tts.toStream(text);
  // msedge-tts v2.x يرجع { audioStream, metadataStream, requestId }
  const readable = result.audioStream || result;
  const chunks = [];
  return new Promise((resolve, reject) => {
    readable.on('data', (c) => chunks.push(c));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// تحويل mp3 → opus عبر ffmpeg (للاتصال الصوتي في ديسكورد)
function mp3ToOpus(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath, ['-i', 'pipe:0', '-f', 'opus', '-ar', '48000', '-ac', '1', 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('close', () => resolve(Buffer.concat(chunks)));
    ff.on('error', reject);
    ff.stdin.end(mp3Buffer);
    ff.stdin.on('error', () => {});
  });
}

// توليد صوت من نص
async function synthesize(text, voice = 'female') {
  const clean = String(text || '').trim().slice(0, 500);
  if (!clean) throw new Error('النص فاضي');
  let mp3;
  try {
    mp3 = await edgeTTS(clean, voice);
  } catch (e) {
    console.warn('[TTS] Edge فشل، بجرب Google:', e.message);
    mp3 = await googleTTS(clean);
  }
  const opus = await mp3ToOpus(mp3);
  return { buffer: opus, duration: Math.ceil(opus.length / 8000) };
}

// تشغيل صوت في روم صوتي (يعمل على الاتصال الحالي)
async function playInVoice(guild, opusBuffer) {
  const client = guild.client;
  // نجرب كل المصادر للاتصال الصوتي
  let conn = null;
  // 1) من voiceStay — client._voiceConn
  if (client._voiceConn && client._voiceConn.state?.status !== 'destroyed') {
    conn = client._voiceConn;
  }
  if (!conn) conn = guild.members?.me?.voice?.connection;
  if (!conn) {
    try {
      const dt = require('./music').dt(client);
      const dv = dt.voices.get(guild.id);
      if (dv?.connection) conn = dv.connection;
    } catch {}
  }
  if (!conn) {
    try {
      const c = require('@discordjs/voice').getVoiceConnection(guild.id);
      if (c) conn = c;
    } catch {}
  }
  if (!conn) throw new Error('البوت مش في روم صوتية');

  const stream = new PassThrough();
  stream.end(opusBuffer);

  const resource = createAudioResource(stream, { inputType: StreamType.OggOpus });
  const player = createAudioPlayer();
  const sub = conn.subscribe(player);
  player.play(resource);

  return new Promise((resolve) => {
    const cleanup = () => { player.stop(); sub?.unsubscribe(); resolve(); };
    player.on(AudioPlayerStatus.Idle, cleanup);
    player.on('error', (e) => { console.error('[TTS] err:', e.message); cleanup(); });
    setTimeout(cleanup, 60000);
  });
}

module.exports = { synthesize, playInVoice, VOICES };
