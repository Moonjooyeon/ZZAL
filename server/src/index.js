// index.js — 서버 부팅. 라우트를 모으고 요청을 받습니다.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import { getDb } from './db/index.js';
import { createRouter } from './http/router.js';
import { serveStatic } from './http/static.js';
import { json, HttpError } from './http/respond.js';

import { authRoutes } from './routes/auth.js';
import { memeRoutes } from './routes/memes.js';
import { boardRoutes } from './routes/boards.js';
import { uploadRoutes } from './routes/uploads.js';
import { reportRoutes } from './routes/reports.js';
import { searchRoutes } from './routes/search.js';
import { startEnricher } from './ai/enrich.js';
import { aiEnabled } from './ai/client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../..');   // 저장소 루트 (index.html이 있는 곳)

const router = createRouter();
router.get('/api/health', (req, res) =>
  json(res, 200, { ok: true, db: config.db.driver, ai: aiEnabled() }));
authRoutes(router);
memeRoutes(router);
boardRoutes(router);
uploadRoutes(router);
reportRoutes(router);
searchRoutes(router);

const db = await getDb();
const enriching = startEnricher(db);
const static_ = config.serveWeb ? serveStatic(webRoot) : null;

const server = http.createServer(async (req, res) => {
  try {
    if (await router.handle(req, res, { db })) return;
    if (static_ && req.method === 'GET' && static_(req, res)) return;
    json(res, 404, { error: 'not_found', message: '없는 주소입니다' });
  } catch (e) {
    if (e instanceof HttpError) {
      json(res, e.status, { error: e.code, message: e.message });
      return;
    }
    console.error(req.method, req.url, e);
    json(res, 500, { error: 'internal', message: '서버에서 문제가 생겼어요' });
  }
});

server.listen(config.port, () => {
  console.log(`이짤이이짤 API — http://localhost:${config.port}`);
  console.log(`  저장소: ${db.driver}`);
  console.log(`  프론트 같이 서빙: ${config.serveWeb ? 'on' : 'off'}`);
  if (config.auth.demo) console.log('  로그인: DEMO_AUTH (앱 키가 없어 임시 계정으로 로그인됩니다)');
  console.log(`  AI: ${aiEnabled() ? config.ai.model : '꺼짐 (CAFE24_LLM_ROUTER_API_KEY 없음)'}`
    + (enriching ? ` · 숨은 키워드 붙이기 ${config.ai.enrich.intervalMs / 1000}초마다` : ''));
});
