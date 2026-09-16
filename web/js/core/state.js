// core/state.js — 화면 전체가 같이 보는 상태 한 덩어리.
// 모듈 사이에서 값을 주고받아야 하므로 개별 변수가 아니라 객체로 둡니다.
// (import 한 변수는 다른 모듈에서 재할당할 수 없기 때문)

export const state = {
  /** @type {Set<number>} 저장한 짤 id */
  saved: new Set(),
  /** @type {Array} 내가 올린 짤 */
  mine: [],
  /** @type {Object<number,{reason:string,at:number}>} 신고해서 숨긴 짤 */
  reported: {},
  /** 현재 카테고리 필터 */
  cat: '전체',
  /** 현재 화면: explore | saved | upload */
  page: 'explore',
  /** 업로드 폼에서 고른 파일 */
  draft: null,
  /** @type {?{id:string,provider:string,name:string}} 로그인 세션 */
  session: null,
};
