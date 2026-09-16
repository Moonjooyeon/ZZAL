// core/catalog.js — 짤 목록 조회. 원본 배열을 화면이 쓰는 객체로 바꿉니다.
import { MEME_ROWS } from '../data/index.js';
import { state } from './state.js';

/**
 * 데이터 한 줄을 화면용 객체로.
 * kw(숨은 키워드)에는 제목과 태그도 같이 넣어 검색이 걸리게 하되,
 * 화면에는 tags만 보여줍니다. kw는 어디에도 렌더링하지 않습니다.
 */
export const meme = (id, name, file, cat, tags, kw, why) => ({
  id,
  name,
  filename: file.split('/').pop(),
  src: file,
  cat,
  tags,
  kw: [name, ...tags, ...kw],
  why,
  art: `<img src="${file}" alt="${name}" loading="lazy">`,
});

/** 카탈로그는 한 번만 만들어 재사용합니다 (806개) */
const CATALOG = MEME_ROWS.map(row => meme(...row));

export const CATEGORIES = ['전체', '리액션', '동물', '그림', '대화·SNS', '글·댓글', '방송·자막'];

/** 기본 카탈로그 + 내가 올린 짤 */
export const all = () => [...CATALOG, ...state.mine];

/** 신고해서 숨긴 짤을 뺀 목록 — 화면에 보이는 것은 전부 이걸 씁니다 */
export const visible = () => all().filter(z => !state.reported[z.id]);

export const byId = id => all().find(z => z.id === id);
export const title = z => z.name;
export const isMine = z => state.mine.some(m => m.id === z.id);
