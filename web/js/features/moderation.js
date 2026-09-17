// features/moderation.js — 확인 다이얼로그 · 짤 삭제 · 신고 · 숨김 해제.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, refreshSaved } from '../core/api.js';
import { byId } from '../core/catalog.js';
import { requireAuth } from './auth.js';
import { render } from './feed.js';

const REASONS = [
  '부적절하거나 불쾌한 콘텐츠',
  '저작권을 침해하는 이미지',
  '스팸 또는 광고',
  '제목·설명이 내용과 다름',
  '기타',
];

/** 공용 확인 다이얼로그. reasons:true면 신고 사유 라디오를 함께 보여줍니다. */
export function ask({ title, desc, reasons, go, danger, onOk }) {
  $('asktitle').textContent = title;
  $('askdesc').textContent = desc;
  $('askreasons').hidden = !reasons;
  $('askreasons').innerHTML = reasons
    ? REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${esc(r)}"${i ? '' : ' checked'}>${esc(r)}</label>`).join('')
    : '';
  $('askgo').textContent = go;
  $('askgo').classList.toggle('danger', !!danger);
  $('ask').onclose = () => {
    if ($('ask').returnValue !== 'ok') return;
    const picked = reasons ? ($('ask').querySelector('input[name=reason]:checked') || {}).value : null;
    onOk(picked);
  };
  $('ask').showModal();
}

export function askDelete(id) {
  const z = byId(id);
  if (!z) return;
  ask({
    title: '이 짤을 삭제할까요?',
    desc: `“${z.name}”을(를) 내 짤에서 완전히 지웁니다. 되돌릴 수 없어요.`,
    go: '삭제',
    danger: true,
    onOk: async () => {
      state.mine = state.mine.filter(x => x.id !== id);
      state.pins = state.pins.filter(p => p.m !== id);   // 담아둔 저장함에서도 빠집니다
      refreshSaved();
      await store.removeUpload(id);
      await store.removePin(id, null);
      if ($('modal').open) $('modal').close();
      render();
      toast('짤을 삭제했어요');
    },
  });
}

export function askReport(id) {
  if (!requireAuth('신고하려면 로그인이 필요해요.')) return;
  const z = byId(id);
  if (!z) return;
  ask({
    title: '이 짤을 신고할까요?',
    desc: `“${z.name}” · 신고한 짤은 내 피드에서 바로 숨겨집니다. 내 짤 화면에서 다시 꺼낼 수 있어요.`,
    reasons: true,
    go: '신고하기',
    onOk: async reason => {
      const picked = reason || '기타';
      state.reported[id] = { reason: picked, at: Date.now() };
      await store.setReport(id, picked);
      if ($('modal').open) $('modal').close();
      render();
      toast('신고했어요. 피드에서 숨겼습니다');
    },
  });
}

export async function unreport(id) {
  delete state.reported[id];
  await store.setReport(id, null);
  render();
  toast('다시 피드에 표시합니다');
}
