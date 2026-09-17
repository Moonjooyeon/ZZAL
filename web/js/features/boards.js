// features/boards.js — 보드. 저장한 짤을 사용자가 만든 묶음에 담습니다.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, refreshSaved } from '../core/api.js';
import { byId, title } from '../core/catalog.js';
import { requireAuth } from './auth.js';
// feed.js와 서로 부릅니다. 둘 다 함수 선언이고 호출은 전부 부팅 뒤라 안전합니다.
import { render, card } from './feed.js';

// ── 조회 ──────────────────────────────────────────────────────────────────
// 'mine'은 내가 올린 짤을 담는 붙박이 자리입니다. 보드에 담지 않아도
// 올린 짤이 사라지지 않도록, 사용자가 만든 보드와 나란히 보여줍니다.
export const MINE = 'mine';
const mineBoard = () => ({
  id: MINE, name: '내가 올린 짤', private: false, system: true,
  at: 0, updatedAt: Math.max(0, ...state.mine.map(m => m.id || 0)),
});

export const boardById = id =>
  id === MINE ? mineBoard() : (state.boards.find(b => b.id === id) || null);
export const pinsOf = id => state.pins.filter(p => p.b === id);

/** 화면에 실제로 보이는 것만 — 신고해서 숨긴 짤은 표지에도 개수에도 넣지 않습니다 */
export const shownOf = id => (id === MINE
  ? [...state.mine].reverse()
  : pinsOf(id).sort((a, b) => b.at - a.at).map(p => byId(p.m))
).filter(z => z && !state.reported[z.id]);
export const boardsOf = memeId => state.pins.filter(p => p.m === memeId).map(p => p.b);

/** 최근에 손댄 보드가 앞으로 */
const sorted = () => [...state.boards].sort((a, b) => b.updatedAt - a.updatedAt);

function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return m + '분';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '시간';
  const d = Math.floor(h / 24);
  if (d < 7) return d + '일';
  const w = Math.floor(d / 7);
  if (w < 5) return w + '주';
  return Math.floor(d / 30) + '개월';
}

// ── 보드 목록 ─────────────────────────────────────────────────────────────
const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

/** 표지: 큰 그림 하나 + 작은 그림 둘 */
function cover(board) {
  const arts = shownOf(board.id).slice(0, 3);
  const cell = z => z ? `<div class="cell">${z.art}</div>` : '<div class="cell empty"></div>';
  return `<div class="cover">${cell(arts[0])}<div class="side">${cell(arts[1])}${cell(arts[2])}</div></div>`;
}

function boardCard(b) {
  const n = shownOf(b.id).length;
  const meta = b.system ? '내가 올린 짤' : `${n}개 &nbsp;·&nbsp; ${ago(b.updatedAt)}`;
  return `<button class="boardcard${b.system ? ' system' : ''}" onclick="openBoard('${b.id}')">${cover(b)}<span class="bname">${esc(b.name)}${b.private ? LOCK : ''}</span><span class="bmeta">${b.system ? n + '개 &nbsp;·&nbsp; ' + meta : meta}</span></button>`;
}

export function renderBoards() {
  const list = state.mine.length ? [mineBoard(), ...sorted()] : sorted();
  $('boardgrid').innerHTML = list.length
    ? list.map(boardCard).join('')
    : '<div class="empty"><h3>아직 보드가 없어요</h3><p>주제별로 보드를 만들어 짤을 모아보세요.<br>“웃긴 짤”, “연성 소재”처럼요.</p><button class="primary" onclick="openBoardForm()">첫 보드 만들기</button></div>';
  $('boardgrid').classList.toggle('boardgrid', !!list.length);
}

// ── 보드 하나 열기 ────────────────────────────────────────────────────────
export function openBoard(id) {
  state.openBoard = id;
  render();
  window.scrollTo(0, 0);
}

export function closeBoard() {
  state.openBoard = null;
  render();
  window.scrollTo(0, 0);
}

/** 보드 하나를 펼친 화면 */
export function renderBoardDetail() {
  const b = boardById(state.openBoard);
  if (!b) { state.openBoard = null; return; }
  const rows = shownOf(b.id);

  $('boardtitle').innerHTML = esc(b.name) + (b.private ? LOCK : '');
  $('boardacts').hidden = !!b.system;
  $('boardmeta').textContent = b.system
    ? `${rows.length}개 · 내가 올린 짤은 여기에 모입니다`
    : `${rows.length}개 · ${ago(b.updatedAt)} 전에 담음` + (b.private ? ' · 나만 보기' : '');
  $('boardboard').classList.toggle('board', !!rows.length);
  $('boardboard').innerHTML = rows.length
    ? rows.map(card).join('')
    : '<div class="empty"><h3>아직 비어 있어요</h3><p>둘러보다 마음에 드는 짤의 책갈피를 누르면<br>이 보드에 담을 수 있어요.</p><button class="primary" onclick="navigate(\'explore\')">짤 둘러보기</button></div>';
}

// ── 보드 만들기 / 이름 바꾸기 ─────────────────────────────────────────────
let formMode = null;   // {edit:boardId} 또는 {pin:memeId} 또는 null

export function openBoardForm(opts) {
  if (!requireAuth('보드를 만들려면 로그인이 필요해요.')) return;
  formMode = opts || {};
  const editing = formMode.edit ? boardById(formMode.edit) : null;
  $('boardformtitle').textContent = editing ? '보드 이름 바꾸기' : '새 보드';
  $('boardname').value = editing ? editing.name : '';
  $('boardprivate').checked = editing ? editing.private : false;
  $('boardprivaterow').hidden = !!editing;
  $('boardsave').textContent = editing ? '저장' : '만들기';
  if ($('pick').open) $('pick').close();
  $('boardform').showModal();
  setTimeout(() => $('boardname').focus(), 30);
}

async function submitBoardForm(e) {
  e.preventDefault();
  const name = $('boardname').value.trim();
  if (!name) return;

  if (formMode.edit) {
    const b = boardById(formMode.edit);
    if (b) { b.name = name; b.updatedAt = Date.now(); }
    await store.renameBoard(formMode.edit, name);
    $('boardform').close();
    render();
    toast('보드 이름을 바꿨어요');
    return;
  }

  const board = await store.createBoard({ name, private: $('boardprivate').checked });
  if (!board) { toast('보드를 만들지 못했어요'); return; }
  state.boards.push(board);
  $('boardform').close();

  // 저장하려다 보드를 만든 경우라면 바로 담아줍니다
  if (formMode.pin != null) {
    await pinTo(formMode.pin, board.id);
    return;
  }
  render();
  toast(`“${board.name}” 보드를 만들었어요`);
}

export function askDeleteBoard(id) {
  const b = boardById(id);
  if (!b) return;
  const n = shownOf(id).length;
  $('asktitle').textContent = '이 보드를 삭제할까요?';
  $('askdesc').textContent = `“${b.name}”과(와) 담아둔 짤 ${n}개가 함께 사라집니다. 짤 자체가 지워지지는 않아요.`;
  $('askreasons').hidden = true;
  $('askreasons').innerHTML = '';
  $('askgo').textContent = '삭제';
  $('askgo').classList.add('danger');
  $('ask').onclose = async () => {
    if ($('ask').returnValue !== 'ok') return;
    state.boards = state.boards.filter(x => x.id !== id);
    state.pins = state.pins.filter(p => p.b !== id);
    refreshSaved();
    await store.deleteBoard(id);
    state.openBoard = null;
    render();
    toast('보드를 삭제했어요');
  };
  $('ask').showModal();
}

// ── 어디에 담을지 고르기 ──────────────────────────────────────────────────
let picking = null;                       // 지금 고르는 중인 짤
let pickOrder = [];                       // 창을 여는 순간의 보드 순서
export const currentPick = () => picking;

export function openPicker(memeId) {
  if (!requireAuth('짤을 저장하려면 로그인이 필요해요.')) return;
  const z = byId(memeId);
  if (!z) return;

  picking = memeId;
  // 보드가 하나도 없으면 고를 것이 없으니 바로 만들기로
  if (!state.boards.length) { openBoardForm({ pin: memeId }); return; }

  $('picktitle').textContent = '어디에 담을까요?';
  $('picksub').textContent = title(z);
  // 담을 때마다 보드의 수정 시각이 갱신돼 목록이 재정렬되면
  // 방금 누른 행이 손가락 밑에서 움직입니다. 열려 있는 동안은 순서를 고정합니다.
  pickOrder = sorted().map(b => b.id);
  renderPicker();
  $('pick').showModal();
}

/** 고르기 목록을 다시 그립니다. 담고 빼는 동안 창은 열어둡니다 —
    같은 짤을 여러 보드에 담을 수 있어야 하기 때문입니다. */
function renderPicker() {
  if (picking == null) return;
  const inBoards = new Set(boardsOf(picking));
  const rows = pickOrder.map(boardById).filter(Boolean);
  state.boards.forEach(b => { if (!pickOrder.includes(b.id)) rows.push(b); });
  $('picklist').innerHTML = rows.map(b => {
    const on = inBoards.has(b.id);
    const thumb = (shownOf(b.id)[0] || {}).art || '';
    return `<button class="pickrow${on ? ' on' : ''}" onclick="pinTo(${picking},'${b.id}')" aria-pressed="${on}"><span class="thumb">${thumb}</span><span class="pname">${esc(b.name)}${b.private ? LOCK : ''}</span><span class="pstate">${on ? '담김 ✓' : '담기'}</span></button>`;
  }).join('');
  $('pickclear').hidden = !inBoards.size;
  $('pickclear').textContent = `${inBoards.size}개 보드에서 모두 빼기`;
}

/** 보드에 담기 / 이미 담겼으면 그 보드에서만 빼기 */
export async function pinTo(memeId, boardId) {
  const on = state.pins.some(p => p.m === memeId && p.b === boardId);
  const b = boardById(boardId);
  if (on) {
    state.pins = state.pins.filter(p => !(p.m === memeId && p.b === boardId));
  } else {
    state.pins.push({ m: memeId, b: boardId, at: Date.now() });
  }
  if (b) b.updatedAt = Date.now();
  refreshSaved();
  await (on ? store.removePin(memeId, boardId) : store.addPin(memeId, boardId));

  renderPicker();
  render();
  toast(on ? `“${b ? b.name : '보드'}”에서 뺐어요` : `“${b ? b.name : '보드'}”에 담았어요`);
}

/** 모든 보드에서 빼기 — 카드의 저장 버튼을 다시 누른 경우 */
export async function unpinAll(memeId) {
  const id = memeId != null ? memeId : picking;
  if (id == null) return;
  state.pins = state.pins.filter(p => p.m !== id);
  refreshSaved();
  await store.removePin(id, null);
  if ($('pick').open) $('pick').close();
  render();
  toast('저장을 취소했어요');
}

export function initBoards() {
  $('boardformform').onsubmit = submitBoardForm;
}
