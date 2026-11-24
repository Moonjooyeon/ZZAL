// data/index.js — 짤 원본 데이터를 한 줄로 합칩니다.
// 새 배치를 반입하면 여기에 import 한 줄만 추가하면 됩니다.
import { ROWS as core } from './memes-core.js';
import { ROWS as b01 } from './memes-01.js';
import { ROWS as b02 } from './memes-02.js';
import { ROWS as b03 } from './memes-03.js';
import { ROWS as b04 } from './memes-04.js';
import { ROWS as b05 } from './memes-05.js';
import { ROWS as b06 } from './memes-06.js';
import { ROWS as notMememy } from './memes-not-mememy.js';
import { ROWS as pinterestBoards } from './memes-pinterest-boards.js';

/** @type {Array} [id, 제목, 파일경로, 카테고리, [태그], [숨은 키워드], 설명, 원문 URL?] */
export const BASE_MEME_ROWS = [...core, ...b01, ...b02, ...b03, ...b04, ...b05, ...b06];
export const IMPORTED_MEME_ROWS = [...notMememy, ...pinterestBoards];
export const MEME_ROWS = [...BASE_MEME_ROWS, ...IMPORTED_MEME_ROWS];
