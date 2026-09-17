// ai/enrich.js — 주기 작업. 아직 손대지 않은 올린 짤을 찾아 분류하고
// 숨은 키워드를 붙입니다. 크롤러처럼 조금씩 계속 돕니다.
//
// 업로드 응답을 기다리게 하지 않으려고 따로 뺐습니다.
// 올린 직후에는 임시 분류로 보이고, 잠시 뒤 제대로 채워집니다.
import { config } from '../config.js';
import { aiEnabled } from './client.js';
import { classify } from './classify.js';

let timer = null;
let running = false;

async function tick(db) {
  if (running) return;          // 앞 차례가 아직 안 끝났으면 건너뜁니다
  running = true;
  try {
    const rows = await db.memes.needEnrich(config.ai.enrich.batch);
    for (const m of rows) {
      const out = await classify({ name: m.name, image: m.image_path });
      if (!out) {
        // 실패한 것을 계속 다시 집지 않도록 표시만 남깁니다
        await db.memes.markEnriched(m.id, null);
        console.warn(`[enrich] ${m.id} 분류 실패 — 규칙 분류를 유지합니다`);
        continue;
      }
      await db.memes.markEnriched(m.id, out);
      console.log(`[enrich] ${m.id} “${out.name}” → ${out.cat} · 키워드 ${out.keywords.length}개`);
    }
  } catch (e) {
    console.error('[enrich] 오류:', e && e.message ? e.message : e);
  } finally {
    running = false;
  }
}

export function startEnricher(db) {
  if (!aiEnabled() || !config.ai.enrich.on) return false;
  timer = setInterval(() => tick(db), config.ai.enrich.intervalMs);
  timer.unref();
  setTimeout(() => tick(db), 2000).unref();   // 뜨자마자 한 번
  return true;
}

export function stopEnricher() {
  if (timer) clearInterval(timer);
  timer = null;
}
