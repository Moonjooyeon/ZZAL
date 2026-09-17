// ai/search.js — 검색 2차 검증.
//
// 1차는 우리 카탈로그 안에서 규칙으로 찾습니다(web/js/features/search.js).
// 거기서 못 찾았을 때만 여기로 와서, AI가 "그 말이 우리 데이터에서는
// 어떤 말인지"로 바꿔줍니다. 짤을 지어내는 게 아니라 검색어만 옮깁니다.
import { askJson, aiEnabled } from './client.js';
import { CATEGORIES, ALL_WORDS, vocabBlock } from './vocabulary.js';

const SYSTEM = `너는 한국어 짤(밈) 검색을 돕는다.

사용자가 찾는 말을 우리 짤 데이터에 실제로 들어 있는 말로 바꿔주는 것이 네 일이다.
없는 짤을 지어내지 말고, 짤을 추천하지도 마라. 검색어만 옮긴다.

규칙:
- terms에는 아래 "자주 쓰이는 말" 목록에 있는 단어만 넣는다. 목록에 없는 단어는 넣지 않는다.
- 사용자가 상황이나 감정을 말하면 그 상황에 어울리는 말로 옮긴다.
  예: "면접에서 떨어졌을 때" → 우울, 슬픔, 좌절, 취업
- 유행어·초성·줄임말은 풀어서 옮긴다. 예: "킹받네" → 빡침, 화남, 짜증
- cats에는 어울리는 카테고리만 넣는다. 확신이 없으면 빈 배열로 둔다.
- terms는 최대 8개. 억지로 채우지 마라.
- 정말 짐작할 수 없으면 terms를 빈 배열로 둔다.

${vocabBlock()}`;

const SCHEMA = {
  type: 'object',
  properties: {
    terms: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    cats: { type: 'array', items: { type: 'string', enum: CATEGORIES } },
    note: { type: 'string', description: '사용자에게 보여줄 한 줄 설명. 15자 이내.' },
  },
  required: ['terms', 'cats', 'note'],
  additionalProperties: false,
};

/** @returns {Promise<?{terms:string[],cats:string[],note:string}>} */
export async function assistSearch(query) {
  if (!aiEnabled()) return null;
  const q = String(query || '').trim().slice(0, 200);
  if (!q) return null;

  const out = await askJson({
    system: SYSTEM,
    content: [{ type: 'text', text: `사용자가 찾는 것: ${q}` }],
    schema: SCHEMA,
    effort: 'low',
    maxTokens: 800,
  });
  if (!out || !Array.isArray(out.terms)) return null;

  // 지어낸 단어가 섞여 들어오면 검색이 0건이 되므로 한 번 더 거릅니다.
  // 카탈로그에 실제로 있는 말이면 프롬프트에 안 보여준 것이라도 통과시킵니다.
  const terms = out.terms.filter(t => typeof t === 'string' && ALL_WORDS.has(t)).slice(0, 8);
  return { terms, cats: Array.isArray(out.cats) ? out.cats : [], note: String(out.note || '') };
}
