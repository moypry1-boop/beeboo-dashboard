// نظام تشغيل الأغاني — DisTube لكل بوت مستقل
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const ytsr = require('@distube/ytsr');

// نسخة مشتركة من البلوجنز عشان نستخدم بحث ساوندكلاود كاحتياطي
let _scPlugin = null;
function scPlugin() {
  if (!_scPlugin) _scPlugin = new SoundCloudPlugin();
  return _scPlugin;
}

function init(client) {
  const distube = new DisTube(client, {
    emitNewSongOnly: true,
    plugins: [new YouTubePlugin(), scPlugin()],
    ffmpeg: { path: require('ffmpeg-static') }, // مسار ffmpeg من الحزمة المدمجة
  });
  distube._tag = Math.random().toString(36).slice(2, 7);

  distube.on('playSong', (_q, song) => {
    console.log(`[MUSIC ${client._botId} #${distube._tag}] ▶️ ${song.name}`);
  });
  distube.on('addSong', (_q, song) => {
    console.log(`[MUSIC ${client._botId} #${distube._tag}] ➕ اتضافت للقائمة: ${song.name}`);
  });
  distube.on('error', (...args) => {
    const err = args.find((a) => a instanceof Error) || args[0];
    console.error(`[MUSIC ${client._botId} #${distube._tag}] ❌`, err?.errorCode || '', err?.message || String(err));
  });
  distube.on('disconnect', () => console.log(`[MUSIC ${client._botId} #${distube._tag}] قطع الاتصال الصوتي`));
  distube.on('deleteQueue', (q) => console.log(`[MUSIC ${client._botId} #${distube._tag}] 🗑️ deleteQueue (songs=${q?.songs?.length ?? '?'}, playing=${q?.playing ?? '?'})`));
  distube.on('empty', (q) => console.log(`[MUSIC ${client._botId} #${distube._tag}] 🈳 empty event`));
  distube.on('finish', (q) => console.log(`[MUSIC ${client._botId} #${distube._tag}] 🏁 finish`));
  distube.on('noRelated', (q) => console.log(`[MUSIC ${client._botId} #${distube._tag}] 🚫 noRelated`));
  if (process.env.MUSIC_DEBUG) distube.on('debug', (m) => console.log(`[DISTUBE #${distube._tag}]`, m));

  client._disTube = distube;
  return distube;
}

function dt(client) {
  if (!client._disTube) init(client);
  return client._disTube;
}

// فحص سريع: الرابط ده ينفع يتشغل فعلاً؟ (يوتيوب بيحجب أحيانًا من غير كوكي)
async function ytPlayable(url) {
  try {
    const ytdl = require('@distube/ytdl-core');
    const info = await ytdl.getInfo(url);
    return !!info?.formats?.some((f) => f.hasAudio);
  } catch {
    return false;
  }
}

// لو النص مش رابط → دوّر على يوتيوب وارجع أول نتيجة
// لو يوتيوب رفض (حظر بوتات) → نروح ساوندكلاوند تلقائيًا
async function resolveQuery(client, query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('اكتب اسم الأغنية أو الرابط');
  const isUrl = /^https?:\/\//i.test(q);

  // 1) جرب يوتيوب
  let ytUrl = q;
  try {
    if (!isUrl) {
      const results = await ytsr(q, { limit: 1, type: 'video' });
      ytUrl = results?.items?.[0]?.url || '';
      if (!ytUrl) throw new Error('no-results');
    }
    if (await ytPlayable(ytUrl)) return ytUrl;
    console.warn(`[MUSIC ${client._botId}] يوتيوب رفض التشغيل — بجرب ساوندكلاوند`);
  } catch { /* هنكمل لساوندكلاوند تحت */ }

  // 2) ساوندكلاوند احتياطي
  const alt = await scSearch(q);
  if (alt) return alt.url;
  throw new Error('ملقتش مصدر شغال للأغنية دي 😕 (يوتيوب مرفوض وساوندكلاوند فاضي)');
}

// بحث ساوندكلاود (احتياطي لما يوتيوب يرفض)
async function scSearch(query) {
  try {
    const songs = await scPlugin().search(String(query), undefined, 1);
    return songs?.[0]?.url ? { url: songs[0].url, name: songs[0].name } : null;
  } catch {
    return null;
  }
}

// تشغيل/إضافة لقائمة سيرفر معين — بيتكفل بالاتصال الصوتي بنفسه
async function play(client, guild, channelId, query) {
  const distube = dt(client);
  const vc = client.channels.cache.get(String(channelId));
  if (!vc || !vc.isVoiceBased?.()) throw new Error('الروم الصوتية دي مش موجودة أو مش صوتية');

  const url = await resolveQuery(client, query);

  // اتصال مُدار جاهز على الروم المستهدفة قبل أي حاجة
  const existing = distube.voices.get(guild.id);
  if (!existing || existing.channelId !== vc.id) {
    await distube.voices.join(vc);
  }

  try {
    await distube.play(vc, url);
  } catch (e) {
    // يوتيوب بيرفض أحيانًا (حظر بوتات) → نجرب ساوندكلاوند بنفس الاسم
    if (/playable formats|Sign in|confirm you|429/i.test(e.message)) {
      const alt = await scSearch(query);
      if (!alt) throw e;
      await distube.play(vc, alt.url);
    } else {
      throw e;
    }
  }
}

function songJson(s) {
  if (!s) return null;
  return {
    name: s.name || '—',
    url: s.url || '',
    duration: s.formattedDuration || '',
    thumbnail: s.thumbnail || null,
    uploader: s.uploader?.name || s.uploader || '',
  };
}

// حالة التشغيل الحالية للسيرفر
function status(client, guildId) {
  try {
    const q = client._disTube?.getQueue(guildId);
    if (process.env.MUSIC_DEBUG) console.log(`[MUSIC DBG #${client._disTube?._tag}] status(${guildId}) → queue=${!!q} songs=${q?.songs?.length ?? '-'} voice=${q?.voice?.channelId ?? '-'}`);
    if (!q) return { active: false, paused: false, volume: 80, channelId: null, current: null, songs: [] };
    return {
      active: q.songs.length > 0,
      paused: !!q.paused,
      volume: q.volume ?? 80,
      channelId: q.voice?.channel?.id || null,
      current: songJson(q.songs[0]),
      songs: q.songs.slice(1, 40).map(songJson),
    };
  } catch {
    return { active: false, paused: false, volume: 80, channelId: null, current: null, songs: [] };
  }
}

module.exports = { init, dt, resolveQuery, play, status };
