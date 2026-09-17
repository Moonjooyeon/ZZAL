// routes/search.js — 검색 2차 검증.
//   POST /api/search/assist   { q }  →  { terms, cats, note }
//
// 1차(규칙 검색)에서 못 찾았을 때만 프론트가 부릅니다.
// 짤을 고르는 건 여전히 프론트의 규칙 검색이고, 여기서는 검색어만 옮겨줍니다.
import { ok, badRequest, readJson } from '../http/respond.js';
import { assistSearch } from '../ai/search.js';
import { aiEnabled } from '../ai/client.js';

export function searchRoutes(router) {
  router.post('/api/search/assist', async (req, res) => {
    const { q } = await readJson(req, 4096);
    const query = String(q || '').trim();
    if (!query) throw badRequest('찾을 말을 적어주세요');
    if (!aiEnabled()) return ok(res, { enabled: false, terms: [], cats: [], note: '' });

    const out = await assistSearch(query);
    ok(res, out ? { enabled: true, ...out } : { enabled: true, terms: [], cats: [], note: '' });
  });
}
