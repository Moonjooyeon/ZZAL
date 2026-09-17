// config.js — 환경변수를 한 군데서 읽습니다. .env.example 참고.
import fs from 'node:fs';
import path from 'node:path';

// 의존성 없이 .env 를 읽습니다 (있으면).
const envFile = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

const bool = (v, d = false) => (v === undefined ? d : /^(1|true|yes)$/i.test(v));

export const config = {
  port: Number(process.env.PORT || 8080),
  serveWeb: bool(process.env.SERVE_WEB, true),
  publicOrigin: process.env.PUBLIC_ORIGIN || `http://localhost:${process.env.PORT || 8080}`,

  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
  cookieSecure: bool(process.env.COOKIE_SECURE, false),

  db: {
    driver: process.env.DB_DRIVER || 'json',
    file: process.env.DB_FILE || './data/zzal.json',
    url: process.env.DATABASE_URL || '',
  },

  // AI는 곁들임입니다. 키가 없으면 검색·분류는 지금처럼 규칙만으로 돌아갑니다.
  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-opus-5',
    // 사내 프록시를 거치거나 테스트용 가짜 서버를 붙일 때
    baseUrl: process.env.AI_BASE_URL || '',
    // 올린 짤에 숨은 키워드를 붙이는 주기 작업
    enrich: {
      on: bool(process.env.AI_ENRICH, true),
      intervalMs: Number(process.env.AI_ENRICH_INTERVAL_MS || 30000),
      batch: Number(process.env.AI_ENRICH_BATCH || 3),
    },
  },

  auth: {
    demo: bool(process.env.DEMO_AUTH, true),
    kakao: { id: process.env.KAKAO_CLIENT_ID || '', secret: process.env.KAKAO_CLIENT_SECRET || '' },
    google: { id: process.env.GOOGLE_CLIENT_ID || '', secret: process.env.GOOGLE_CLIENT_SECRET || '' },
  },
};

if (config.sessionSecret === 'dev-only-insecure-secret' && process.env.NODE_ENV === 'production') {
  throw new Error('SESSION_SECRET을 설정하지 않고 production으로 띄울 수 없습니다.');
}
