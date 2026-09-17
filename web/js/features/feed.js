// features/feed.js — 피드 화면. 카드 그리기, 화면 전환, 카테고리 필터, 검색 결과 반영.
import { $, esc, icons } from '../core/dom.js';
import { state } from '../core/state.js';
import { all, visible, title, CATEGORIES } from '../core/catalog.js';
import { rank } from './search.js';
import { adCard, adSlot, adIndex } from './ads.js';
import { renderBoards, renderBoardDetail } from './boards.js';

// ── 카드 ──────────────────────────────────────────────────────────────────
export function card(z) {
  const t = esc(title(z));
  const on = state.saved.has(z.id);
  return `<article class="pin"><button class="shot" onclick="openDetail(${z.id})" aria-label="${t} 자세히 보기"><div class="art">${z.art}</div></button><div class="meta"><h3>${t}</h3><button class="save" aria-label="${t} ${on ? '저장 취소' : '저장'}" aria-pressed="${on}" onclick="toggle(${z.id})">${icons.save}</button></div><p class="tags">${z.tags.map(x => '#' + esc(x)).join(' &nbsp; ')}</p></article>`;
}

function feedCards(rows) {
  const out = [];
  rows.forEach((z, i) => {
    out.push(card(z));
    if (adSlot(i)) out.push(adCard(adIndex(i)));
  });
  return out.join('');
}

function empty(heading, body) {
  return `<div class="empty"><h3>${heading}</h3><p>${body}</p><button onclick="resetFeed();navigate('explore')">짤 둘러보기</button></div>`;
}

const GATE = '<div class="gate"><h3>로그인하면 여기에 모여요</h3><p>저장한 짤과 직접 올린 짤을 계정에 담아두고,<br>다른 기기에서도 그대로 꺼내 볼 수 있어요.</p><button class="primary" onclick="openLogin()">로그인</button></div>';

// ── 화면 전환 ─────────────────────────────────────────────────────────────
export function navigate(page) {
  // 내 짤로 (다시) 들어오면 항상 저장함 목록부터. 열어뒀던 저장함이 따라오지 않게.
  if (page !== 'saved' || state.page !== 'saved') state.openBoard = null;
  state.page = page;
  ['explore', 'saved', 'upload'].forEach(x => { $(x).hidden = x !== page; });
  document.querySelectorAll('[data-page]').forEach(b => {
    const on = b.dataset.page === page;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  render();
  window.scrollTo(0, 0);
}

export function query(q) {
  $('q').value = q;
  state.cat = '전체';
  navigate('explore');
}

export function resetFeed() {
  $('q').value = '';
  state.cat = '전체';
  render();
}

// ── 그리기 ────────────────────────────────────────────────────────────────
function renderExplore() {
  const raw = $('q').value.trim();
  const q = raw.toLowerCase();
  let rows = visible().filter(z => state.cat === '전체' || z.cat === state.cat);
  if (q) rows = rank(rows, q);

  $('heading').textContent = q ? `“${raw}” 검색 결과`
    : state.cat === '전체' ? '오늘, 이 짤 어때요?' : state.cat + ' 모아보기';
  $('summary').textContent = q
    ? rows.length + '개의 짤 · 키워드가 겹치는 순서로 보여드려요'
    : '말로 하기 애매할 때 꺼내 쓰기 좋은 짤 · ' + rows.length + '개';
  $('reset').hidden = !q;
  $('board').classList.toggle('board', !!rows.length);
  $('board').innerHTML = rows.length
    ? feedCards(rows)
    : empty('아직 맞는 짤이 없어요', '“잠수”, “야근”처럼 짧은 말로 다시 찾아보세요.');
}

function renderSaved() {
  const inBoard = state.session && state.openBoard;

  $('savedintro').hidden = !!inBoard;
  $('boardsgate').hidden = !!state.session;
  $('boardsview').hidden = !state.session || !!inBoard;
  $('boardview').hidden = !inBoard;

  if (!state.session) { $('boardsgate').innerHTML = GATE; return; }
  if (inBoard) renderBoardDetail();
  else renderBoards();
}

/** 신고해서 숨긴 짤 — 내 짤 화면 아래에 되돌릴 수 있게 남겨둡니다 */
function renderReported() {
  const ids = state.session
    ? Object.keys(state.reported).map(Number).filter(id => all().some(z => z.id === id))
    : [];
  $('reportedbox').hidden = !ids.length;
  if (!ids.length) return;

  const rows = ids.map(id => {
    const z = all().find(z => z.id === id);
    return `<div class="reportedrow"><div><strong>${esc(title(z))}</strong><small>${esc(state.reported[id].reason || '기타')}</small></div><button onclick="unreport(${id})">숨김 해제</button></div>`;
  }).join('');
  $('reportedbox').innerHTML = `<h3>신고해서 숨긴 짤 ${ids.length}개</h3><p>이 브라우저에서만 숨겨집니다. 잘못 눌렀다면 아래에서 되돌릴 수 있어요.</p><div class="reportedlist">${rows}</div>`;
}

/** 상태가 바뀔 때마다 부르는 단 하나의 갱신 함수 */
export function render() {
  renderExplore();
  renderReported();
  renderSaved();
  $('footcount').textContent = `콘텐츠 ${visible().length}개 · 검색은 키워드 기준`;
  document.querySelectorAll('.count').forEach(e => { e.textContent = state.saved.size || ''; });
  document.querySelectorAll('#filters button').forEach(e => {
    e.classList.toggle('active', e.textContent === state.cat);
    e.setAttribute('aria-pressed', e.textContent === state.cat);
  });
}

// ── 초기화 ────────────────────────────────────────────────────────────────
export function initFeed() {
  $('search').onsubmit = e => { e.preventDefault(); render(); };
  CATEGORIES.forEach(c => {
    const b = document.createElement('button');
    b.textContent = c;
    b.onclick = () => { state.cat = c; render(); };
    $('filters').append(b);
  });
}
