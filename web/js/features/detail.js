// features/detail.js — 짤 상세 모달. ?z=<id> 딥링크도 여기서 처리합니다.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store } from '../core/api.js';
import { all, byId, title, isMine } from '../core/catalog.js';
import { render } from './feed.js';

const MINE_NOTE = '<p style="font-size:11px;margin-top:22px">이 브라우저에만 보관한 이미지입니다. 공유 링크로는 다른 사람에게 보이지 않아요.</p>';

/** 모달 안쪽을 다시 그립니다 (저장 상태가 바뀌면 다시 불립니다) */
export function renderDetail(id) {
  const z = byId(id);
  if (!z) return;
  const own = isMine(z);
  const actions = [
    `<button onclick="toggle(${id})">${state.saved.has(id) ? '저장됨 ✓' : '내 짤에 저장'}</button>`,
    z.src ? `<button onclick="download(${id})">이미지 내려받기</button>`
          : `<button onclick="copyText(${id})">문구 복사</button>`,
    `<button onclick="openShare(${id})">공유</button>`,
    own ? `<button class="danger" onclick="askDelete(${id})">삭제</button>`
        : `<button class="report" onclick="askReport(${id})">신고</button>`,
  ].join('');

  $('detail').innerHTML = `<div class="detail"><div class="art">${z.art}</div><div class="detailcopy"><p>${esc(z.cat)}${own ? ' · 내가 추가한 짤' : ''}</p><h2>${esc(title(z))}</h2><p>${z.why}</p><p>${z.tags.map(t => '#' + esc(t)).join(' ')}</p><div class="actions">${actions}</div>${own ? MINE_NOTE : ''}</div></div>`;
}

export function openDetail(id) {
  renderDetail(id);
  $('modal').showModal();
  try { history.replaceState(null, '', location.pathname + '?z=' + id); } catch {}
}

/** 공유 링크로 들어왔을 때 해당 짤을 바로 열어줍니다 */
export function openFromUrl() {
  const m = /[?&]z=(\d+)/.exec(location.search);
  if (!m) return;
  const id = Number(m[1]);
  if (!all().some(z => z.id === id)) return;
  // 내가 숨긴 짤의 링크를 직접 열었다면 숨김을 풀어줍니다
  if (state.reported[id]) {
    delete state.reported[id];
    store.setReport(id, null);
    render();
  }
  openDetail(id);
}

export function download(id) {
  const z = byId(id);
  if (!z) return;
  const a = document.createElement('a');
  a.href = z.src;
  a.download = z.filename || '내짤.png';
  a.click();
}

/** 이미지가 없는 목업 짤(.z-chat 등)은 문구만 복사합니다 */
export async function copyText(id) {
  const z = byId(id);
  if (!z) return;
  const box = document.createElement('div');
  box.innerHTML = z.art;
  const text = box.innerText;
  try {
    await navigator.clipboard.writeText(text);
    toast('문구를 복사했어요');
  } catch {
    const a = document.createElement('textarea');
    a.value = text;
    $('detail').append(a);
    a.select();
    const ok = document.execCommand('copy');
    a.remove();
    toast(ok ? '문구를 복사했어요' : '복사하지 못했어요. 짤의 문구를 직접 선택해주세요.');
  }
}

export function initDetail() {
  // 닫으면 주소에서 ?z= 를 지웁니다
  $('modal').addEventListener('close', () => {
    try { history.replaceState(null, '', location.pathname); } catch {}
  });
  // 바깥을 누르면 닫기
  $('modal').addEventListener('click', e => {
    if (e.target !== $('modal')) return;
    const r = $('modal').getBoundingClientRect();
    const out = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (out) $('modal').close();
  });
}
