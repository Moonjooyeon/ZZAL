// core/dom.js — DOM을 만질 때 반복해서 쓰는 것들.

/** 아이디로 엘리먼트 하나 */
export const $ = id => document.getElementById(id);

/** HTML 문자열에 값을 끼워 넣기 전에 반드시 통과시킬 것 */
export const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

let toastTimer = null;
/** 화면 아래 잠깐 뜨는 알림 */
export function toast(message) {
  $('toast').textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 2600);
}

export const icons = {
  save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
};
