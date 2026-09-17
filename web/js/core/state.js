// core/state.js — 화면 전체가 같이 보는 상태 한 덩어리.
// 모듈 사이에서 값을 주고받아야 하므로 개별 변수가 아니라 객체로 둡니다.
// (import 한 변수는 다른 모듈에서 재할당할 수 없기 때문)

export const state = {
  /** @type {Array<{id:string,name:string,private:boolean,at:number,updatedAt:number}>} 저장함 */
  boards: [],
  /** @type {Array<{m:number,b:string,at:number}>} 어느 저장함에 어떤 짤을 담았는지 */
  pins: [],
  /** @type {Set<number>} 한 곳이라도 담긴 짤 id — pins에서 계산합니다 */
  saved: new Set(),
  /** @type {?string} 지금 열어본 저장함. null이면 저장함 목록 */
  openBoard: null,
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
