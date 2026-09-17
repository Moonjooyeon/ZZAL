// ai/vocabulary.js — 카탈로그가 실제로 쓰는 말을 모읍니다.
//
// AI가 우리 짤에 없는 단어를 지어내면 검색이 0건으로 끝납니다.
// 그래서 "이 안에 있는 말로만 답하라"고 목록을 함께 건넵니다.
import { MEME_ROWS } from '../../../web/js/data/index.js';

const CATS = [...new Set(MEME_ROWS.map(r => r[3]))];

// 자주 쓰이는 태그·키워드 순으로. 너무 길면 매 호출 비용이 되므로 상위만.
const freq = new Map();
for (const [, , , , tags, kw] of MEME_ROWS) {
  for (const w of [...tags, ...kw]) {
    if (w.length < 2) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
}
// 프롬프트에 보여줄 것은 자주 쓰이는 상위 일부만 — 전부 넣으면 매 호출이 무거워집니다.
const WORDS = [...freq.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 400)
  .map(([w]) => w);

export const CATEGORIES = CATS;
export const VOCAB = WORDS;

/**
 * 답을 거를 때 쓰는 전체 어휘.
 * 프롬프트에 안 보여준 말이라도 카탈로그에 실제로 있으면 통과시켜야 합니다.
 * (상위 400개로 거르면 '취업' 같은 멀쩡한 말이 버려집니다)
 */
export const ALL_WORDS = new Set(freq.keys());

/** 매 호출 같은 문자열이어야 캐시가 걸립니다 */
export const vocabBlock = () =>
  `카테고리: ${CATS.join(', ')}\n\n자주 쓰이는 말 ${WORDS.length}개:\n${WORDS.join(', ')}`;
