// features/boards.js — 저장함. 저장한 짤을 사용자가 만든 묶음에 담습니다.
// 저장함에 넣지 않고 그냥 저장만 해두는 것도 됩니다(b === null).
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, refreshSaved } from '../core/api.js';
import { byId, title } from '../core/catalog.js';
import { requireAuth } from './auth.js';
// feed.js와 서로 부릅니다. 둘 다 함수 선언이고 호출은 전부 부팅 뒤라 안전합니다.
import { render, card } from './feed.js';

const LOCK = '<svg class="lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

// ── 붙박이 자리 ───────────────────────────────────────────────────────────
// 사용자가 만든 저장함 말고, 늘 있는 두 자리.
export const MINE = 'mine';    // 내가 올린 짤
export const LOOSE = 'loose';  // 저장함에 넣지 않고 저장만 한 짤

const mineBoard = () => ({
  id: MINE, name: '내가 올린 짤', system: true, private: false,
  at: 0, updatedAt: Math.max(0, ...state.mine.map(m => m.id || 0)),
});
const looseBoard = () => ({
  id: LOOSE, name: '저장함 없이 담은 짤', system: true, private: false,
  at: 0, updatedAt: Math.max(0, ...state.pins.filter(p => p.b === null).map(p => p.at || 0)),
});

// ── 조회 ──────────────────────────────────────────────────────────────────
export const boardById = id =>
  id === MINE ? mineBoard()
  : id === LOOSE ? looseBoard()
  : (state.boards.find(b => b.id === id) || null);

export const pinsOf = id => state.pins.filter(p => p.b === (id === LOOSE ? null : id));
export const boardsOf = memeId => state.pins.filter(p => p.m === memeId).map(p => p.b);

/** 화면에 실제로 보이는 것만 — 신고해서 숨긴 짤은 표지에도 개수에도 넣지 않습니다 */
export const shownOf = id => (id === MINE
  ? [...state.mine].reverse()
  : pinsOf(id).sort((a, b) => b.at - a.at).map(p => byId(p.m))
).filter(z => z && !state.reported[z.id]);

/** 최근에 손댄 저장함이 앞으로 */
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

// ── 저장함 목록 ───────────────────────────────────────────────────────────
/** 표지: 큰 그림 하나 + 작은 그림 둘 */
function cover(board) {
  const arts = shownOf(board.id).slice(0, 3);
  const cell = z => z ? `<div class="cell">${z.art}</div>` : '<div class="cell empty"></div>';
  return `<div class="cover">${cell(arts[0])}<div class="side">${cell(arts[1])}${cell(arts[2])}</div></div>`;
}

function boardCard(b) {
  const n = shownOf(b.id).length;
  const meta = b.system ? `${n}개` : `${n}개 &nbsp;·&nbsp; ${ago(b.updatedAt)}`;
  return `<button class="boardcard${b.system ? ' system' : ''}" onclick="openBoard('${b.id}')">${cover(b)}<span class="bname">${esc(b.name)}${b.private ? LOCK : ''}</span><span class="bmeta">${meta}</span></button>`;
}

export function renderBoards() {
  const fixed = [];
  if (state.mine.length) fixed.push(mineBoard());
  if (state.pins.some(p => p.b === null)) fixed.push(looseBoard());
  const list = [...fixed, ...sorted()];

  $('boardgrid').innerHTML = list.length
    ? list.map(boardCard).join('')
    : '<div class="empty"><h3>아직 저장함이 없어요</h3><p>주제별로 저장함을 만들어 짤을 모아보세요.<br>“웃긴 짤”, “연성 소재”처럼요.</p><button class="primary" onclick="openBoardForm()">첫 저장함 만들기</button></div>';
  $('boardgrid').classList.toggle('boardgrid', !!list.length);
  // 붙박이 자리까지 세면 숫자가 저장함 개수와 어긋나 보여서 숫자를 빼둡니다
  $('savedheading').textContent = '저장함';
}

// ── 저장함 하나 열기 ──────────────────────────────────────────────────────
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

export function renderBoardDetail() {
  const b = boardById(state.openBoard);
  if (!b) { state.openBoard = null; return; }
  const rows = shownOf(b.id);

  $('boardtitle').innerHTML = esc(b.name) + (b.private ? LOCK : '');
  $('boardacts').hidden = !!b.system;
  $('boardmeta').textContent = b.system
    ? `${rows.length}개`
    : `${rows.length}개 · ${ago(b.updatedAt)} 전에 담음` + (b.private ? ' · 나만 보기' : '');
  $('boardboard').classList.toggle('board', !!rows.length);
  $('boardboard').innerHTML = rows.length
    ? rows.map(z => card(z, { removable: b.id !== MINE })).join('')
    : '<div class="empty"><h3>아직 비어 있어요</h3><p>둘러보다 마음에 드는 짤의 책갈피를 누르면<br>여기에 담을 수 있어요.</p><button class="primary" onclick="navigate(\'explore\')">짤 둘러보기</button></div>';
}

/** 열린 저장함에서만 짤을 빼고, 다른 저장함의 복사본은 유지합니다. */
export async function removeFromOpenBoard(memeId) {
  const boardId = state.openBoard;
  if (!boardId || boardId === MINE) return;
  const pinBoardId = boardId === LOOSE ? null : boardId;
  if (!state.pins.some(p => p.m === memeId && p.b === pinBoardId)) return;
  try {
    if (!await store.removePin(memeId, pinBoardId)) throw new Error('removePin failed');
    state.pins = state.pins.filter(p => !(p.m === memeId && p.b === pinBoardId));
    refreshSaved();
    render();
    toast('저장함에서 뺐어요');
  } catch {
    toast('저장함에서 빼지 못했어요. 다시 시도해 주세요.');
  }
}

// ── 저장함 만들기 / 이름 바꾸기 ───────────────────────────────────────────
let editing = null;   // 이름을 바꾸는 중인 저장함 id

export function openBoardForm(id) {
  if (!requireAuth('저장함을 만들려면 로그인이 필요해요.')) return;
  editing = id || null;
  const b = editing ? boardById(editing) : null;
  $('boardformtitle').textContent = b ? '저장함 이름 바꾸기' : '새 저장함';
  $('boardname').value = b ? b.name : '';
  $('boardprivate').checked = b ? b.private : false;
  $('boardprivaterow').hidden = !!b;
  $('boardsave').textContent = b ? '저장' : '만들기';
  $('boardform').showModal();
  setTimeout(() => $('boardname').focus(), 30);
}

async function submitBoardForm(e) {
  e.preventDefault();
  const name = $('boardname').value.trim();
  if (!name) return;

  if (editing) {
    const b = boardById(editing);
    if (b) { b.name = name; b.updatedAt = Date.now(); }
    await store.renameBoard(editing, name);
    $('boardform').close();
    render();
    toast('저장함 이름을 바꿨어요');
    return;
  }

  const board = await store.createBoard({ name, private: $('boardprivate').checked });
  if (!board) { toast('저장함을 만들지 못했어요'); return; }
  state.boards.push(board);
  $('boardform').close();
  render();
  toast(`“${board.name}” 저장함을 만들었어요`);
}

export function askDeleteBoard(id) {
  const b = boardById(id);
  if (!b || b.system) return;
  const n = shownOf(id).length;
  $('asktitle').textContent = '이 저장함을 삭제할까요?';
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
    toast('저장함을 삭제했어요');
  };
  $('ask').showModal();
}

// ── 저장하기 ──────────────────────────────────────────────────────────────
const NEW = '__new';
let picking = null;                       // 지금 저장하려는 짤
export const currentPick = () => picking;

export function openPicker(memeId) {
  if (!requireAuth('짤을 저장하려면 로그인이 필요해요.')) return;
  const z = byId(memeId);
  if (!z) return;

  picking = memeId;
  $('savesub').textContent = title(z);

  // 어디에 담을지 — 저장함 없이 / 내 저장함들 / 새로 만들기
  const boxes = sorted();
  $('savepick').innerHTML =
    '<option value="">저장함 없이 저장</option>'
    + (boxes.length
        ? `<optgroup label="내 저장함">${boxes.map(b => `<option value="${b.id}">${esc(b.name)}${b.private ? ' (나만 보기)' : ''}</option>`).join('')}</optgroup>`
        : '')
    + `<option value="${NEW}">＋ 새 저장함 만들기</option>`;
  $('savepick').value = boxes.length ? boxes[0].id : '';
  onPickChange();
  renderSavedIn();
  $('save').showModal();
}

/** 새 저장함을 고르면 이름 칸이 나타납니다 */
export function onPickChange() {
  $('newboxrow').hidden = $('savepick').value !== NEW;
  if (!$('newboxrow').hidden) setTimeout(() => $('boxname').focus(), 30);
}

/** 이미 담긴 곳을 보여주고, 눌러서 뺄 수 있게 */
function renderSavedIn() {
  const at = boardsOf(picking);
  $('savedin').hidden = !at.length;
  if (!at.length) return;
  $('savedin').innerHTML = '<span class="lbl">이미 담긴 곳</span>'
    + at.map(id => {
        const b = id === null ? looseBoard() : boardById(id);
        const label = b ? b.name : '알 수 없음';
        return `<button type="button" class="chip" onclick="unpinFrom(${id === null ? 'null' : `'${id}'`})">${esc(label)} ×</button>`;
      }).join('');
}

async function submitSave(e) {
  e.preventDefault();
  if (picking == null) return;
  const pick = $('savepick').value;

  let boardId = pick === '' ? null : pick;
  if (pick === NEW) {
    const name = $('boxname').value.trim();
    if (!name) { $('boxname').focus(); return; }
    const board = await store.createBoard({ name, private: $('boxprivate').checked });
    if (!board) { toast('저장함을 만들지 못했어요'); return; }
    state.boards.push(board);
    boardId = board.id;
  }

  if (state.pins.some(p => p.m === picking && p.b === boardId)) {
    $('save').close();
    toast('이미 담겨 있어요');
    return;
  }
  state.pins.push({ m: picking, b: boardId, at: Date.now() });
  const b = boardId ? boardById(boardId) : null;
  if (b) b.updatedAt = Date.now();
  refreshSaved();
  await store.addPin(picking, boardId);

  $('save').close();
  render();
  toast(b ? `“${b.name}”에 담았어요` : '저장했어요');
}

/** 이미 담긴 곳에서 빼기 */
export async function unpinFrom(boardId) {
  if (picking == null) return;
  state.pins = state.pins.filter(p => !(p.m === picking && p.b === boardId));
  refreshSaved();
  await store.removePin(picking, boardId);
  renderSavedIn();
  render();
  const b = boardId ? boardById(boardId) : null;
  toast(b ? `“${b.name}”에서 뺐어요` : '저장을 취소했어요');
}

/** 어디에 담겼든 전부 빼기 */
export async function unpinAll(memeId) {
  const id = memeId != null ? memeId : picking;
  if (id == null) return;
  state.pins = state.pins.filter(p => p.m !== id);
  refreshSaved();
  await store.clearPins(id);
  if ($('save').open) $('save').close();
  render();
  toast('저장을 취소했어요');
}

export function initBoards() {
  $('boardformform').onsubmit = submitBoardForm;
  $('saveform').onsubmit = submitSave;
  $('savepick').onchange = onPickChange;
}
