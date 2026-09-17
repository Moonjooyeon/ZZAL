// features/saves.js — 카드와 상세의 저장 버튼.
import { toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, refreshSaved } from '../core/api.js';
import { byId, title } from '../core/catalog.js';
import { requireAuth } from './auth.js';
import { openPicker } from './boards.js';
import { ask } from './moderation.js';
import { render } from './feed.js';

export function toggle(id) {
  if (!requireAuth('짤을 저장하려면 로그인이 필요해요.')) return;
  if (!state.saved.has(id)) { openPicker(id); return; }
  const z = byId(id);
  if (!z) return;
  ask({
    title: '저장을 해제할까요?',
    desc: `“${title(z)}”을(를) 모든 저장함에서 뺍니다. 짤 자체는 삭제되지 않아요.`,
    go: '저장 해제',
    onOk: async () => {
      try {
        if (!await store.clearPins(id)) throw new Error('clearPins failed');
        state.pins = state.pins.filter(p => p.m !== id);
        refreshSaved();
        render();
        toast('저장을 해제했어요');
      } catch {
        toast('저장을 해제하지 못했어요. 다시 시도해 주세요.');
      }
    },
  });
}
