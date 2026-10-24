require('dotenv').config();

module.exports = {
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  botToken: process.env.BOT_TOKEN || '',
  sessionSecret: process.env.SESSION_SECRET || 'wicks-fallback-secret',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  seedBotToken: process.env.BOT_TOKEN || '',
  // AI — الذكاء الصوتي (مفتاح Gemini + النموذج) — التفعيل لكل بوت/روم بيبقى من اللوحة
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gemini-3.6-flash',
  aiChannelId: process.env.AI_CHANNEL_ID || '', // قناة محددة للرد (سيبه فاضي = كل القنوات)
  aiEnabled: process.env.AI_ENABLED !== 'false', // AI_ENABLED=false لتعطيله كلياً
  baseUrl: (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  port: parseInt(process.env.PORT || '3000', 10),
  get redirectUri() {
    return `${this.baseUrl}/auth/callback`;
  },
};
