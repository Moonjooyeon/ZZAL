// ai/classify.js — 올린 짤을 보고 분류하고 숨은 키워드를 붙입니다.
//
// 이미지를 같이 넘깁니다. 사용자가 적은 한 줄만으로는
// "갑자기 일을 떠넘길 때" 정도밖에 알 수 없기 때문입니다.
import { askJson, aiEnabled } from './client.js';
import { CATEGORIES, vocabBlock } from './vocabulary.js';

const SYSTEM = `너는 한국어 짤(밈) 아카이브의 분류를 맡고 있다.

짤 이미지와 올린 사람이 적은 한 줄을 보고 아래를 채운다.

- cat: 카테고리 하나. 아래 목록 중에서만 고른다.
- name: 짤을 부를 짧은 제목. 이미지 안에 대사가 있으면 그 대사를 그대로 쓰는 것이 가장 좋다.
  올린 사람이 적은 한 줄이 이미 제목으로 쓸 만하면 그대로 둔다. 20자 이내.
- tags: 카드에 #으로 보일 태그 2개. 짧은 명사로.
- keywords: 검색에만 쓰는 숨은 키워드 12~20개. 화면에는 절대 보이지 않는다.
  · 이미지 안의 대사와 글자
  · 이 짤을 쓸 만한 상황 (예: 야근, 답장없음, 시험)
  · 감정 (예: 빡침, 서러움, 민망)
  · 같은 뜻의 유행어·초성 (예: 킹받네, ㄹㅇ, 현웃)
  · 소재 (예: 고양이, 메신저, 자막)
  아래 "자주 쓰이는 말"에 있는 단어를 되도록 섞어 넣는다. 그래야 다른 짤과 같이 검색된다.
- why: 언제 쓰는 짤인지 한 문장. "~할 때." 로 끝낸다. 40자 이내.

사람·상표를 단정하지 마라. 확실하지 않으면 생김새나 상황으로 적는다.

${vocabBlock()}`;

const SCHEMA = {
  type: 'object',
  properties: {
    cat: { type: 'string', enum: CATEGORIES },
    name: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
    keywords: { type: 'array', items: { type: 'string' }, minItems: 8, maxItems: 20 },
    why: { type: 'string' },
  },
  required: ['cat', 'name', 'tags', 'keywords', 'why'],
  additionalProperties: false,
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** data: URL을 Claude에 넘길 이미지 블록으로. 아니면 null */
function imageBlock(src) {
  const m = /^data:([\w/+-]+);base64,(.+)$/.exec(String(src || ''));
  if (!m || !IMAGE_TYPES.includes(m[1])) return null;
  // 5MB를 넘으면 요청이 무거워집니다. 그런 짤은 글만으로 분류합니다.
  if (Buffer.byteLength(m[2], 'base64') > 5 * 1024 * 1024) return null;
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
}

/**
 * @returns {Promise<?{cat,name,tags,keywords,why}>} 실패하면 null
 */
export async function classify({ name, image }) {
  if (!aiEnabled()) return null;

  const content = [];
  const img = imageBlock(image);
  if (img) content.push(img);
  content.push({ type: 'text', text: `올린 사람이 적은 한 줄: ${String(name || '').slice(0, 100)}` });

  const out = await askJson({
    system: SYSTEM,
    content,
    schema: SCHEMA,
    effort: 'low',
    maxTokens: 1500,
  });
  if (!out || !CATEGORIES.includes(out.cat)) return null;

  const clean = a => [...new Set((a || [])
    .filter(x => typeof x === 'string')
    .map(x => x.trim())
    .filter(x => x && x.length <= 20))];

  return {
    cat: out.cat,
    name: String(out.name || name || '').trim().slice(0, 60) || String(name || ''),
    tags: clean(out.tags).slice(0, 2),
    keywords: clean(out.keywords).slice(0, 20),
    why: String(out.why || '').trim().slice(0, 80),
  };
}
