// features/moderation.js — 확인 다이얼로그 · 짤 삭제 · 신고 · 숨김 해제.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, refreshSaved, reloadData } from '../core/api.js';
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

export function askBlock(id) {
  if (!requireAuth('게시자를 차단하려면 로그인이 필요해요.')) return;
  const z = byId(id);
  if (!z) return;
  ask({
    title: '이 게시자를 차단할까요?',
    desc: '이 게시자의 콘텐츠가 내 피드에서 즉시 사라지고, 해당 콘텐츠가 운영자에게 함께 신고됩니다.',
    go: '차단 및 신고',
    danger: true,
    onOk: async () => {
      state.blocked[id] = { at: Date.now() };
      state.reported[id] = { reason: '게시자 차단', at: Date.now() };
      await store.blockCreator(id);
      if ($('modal').open) $('modal').close();
      render();
      toast('게시자를 차단하고 운영자에게 신고했어요');
    },
  });
}

export function openBlockedUsers() {
  const groups = new Map();
  Object.entries(state.blocked).forEach(([rawId, block]) => {
    const id = Number(rawId);
    const key = block.blockedUserId ? `user:${block.blockedUserId}` : `meme:${id}`;
    if (!groups.has(key)) groups.set(key, { id, name: byId(id)?.name || `콘텐츠 #${id}` });
  });
  $('blockeduserslist').innerHTML = groups.size
    ? [...groups.values()].map(item => `<div class="blocked-user"><span>${esc(item.name)} 게시자</span><button type="button" onclick="unblockCreator(${item.id})">차단 해제</button></div>`).join('')
    : '<p class="blocked-empty">차단한 게시자가 없습니다.</p>';
  const acct = $('acct');
  if (acct) acct.open = false;
  $('blockedusers').showModal();
}

export async function unblockCreator(id) {
  await store.unblockCreator(id);
  await reloadData();
  render();
  openBlockedUsers();
  toast('게시자 차단을 해제했어요');
}

export async function unreport(id) {
  delete state.reported[id];
  await store.setReport(id, null);
  render();
  toast('다시 피드에 표시합니다');
}
