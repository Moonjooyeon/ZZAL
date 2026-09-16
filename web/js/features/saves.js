// features/saves.js — 짤 저장(내 짤에 담기). 로그인이 필요합니다.
import { $, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store } from '../core/api.js';
import { requireAuth } from './auth.js';
import { render } from './feed.js';
import { renderDetail } from './detail.js';

export async function toggle(id) {
  if (!requireAuth('짤을 저장하려면 로그인이 필요해요.')) return;

  const on = !state.saved.has(id);
  on ? state.saved.add(id) : state.saved.delete(id);
  await store.setSaved(id, on);
  render();
  if ($('modal').open) renderDetail(id);   // 상세가 열려 있으면 버튼 문구도 갱신
  toast(state.saved.has(id) ? '내 짤에 저장했어요' : '저장을 취소했어요');
}
