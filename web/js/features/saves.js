// features/saves.js — 카드와 상세의 저장 버튼.
// 누르면 어느 저장함에 담을지 고르는 창이 열립니다. 같은 짤을 여러 저장함에
// 담을 수 있어야 해서, 저장된 상태에서도 바로 빼지 않고 창을 엽니다.
import { requireAuth } from './auth.js';
import { openPicker } from './boards.js';

export function toggle(id) {
  if (!requireAuth('짤을 저장하려면 로그인이 필요해요.')) return;
  openPicker(id);
}
