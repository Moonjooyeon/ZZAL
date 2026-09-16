// features/auth.js — 로그인/로그아웃. 카카오·구글 소셜 로그인.
//
// 지금은 core/api.js 의 store.signIn 이 데모 세션을 만듭니다.
// 실제 연동은 server/src/auth/ 의 OAuth 라우트로 리다이렉트하도록 store만 바꾸면 됩니다.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, reloadData, mergeGuest, PROVIDERS, PROVIDER_NAME } from '../core/api.js';
import { render, navigate } from './feed.js';

const DEFAULT_SUB = '저장한 짤과 올린 짤을 어느 기기에서든 그대로 꺼내 볼 수 있어요.';

const CARET = '<svg class="caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

/**
 * 헤더 맨 오른쪽. 로그인 전에는 버튼 하나,
 * 로그인 후에는 아바타 칩 하나로 줄이고 나머지는 펼침 메뉴로 넣습니다.
 */
export function renderMe() {
  // 로그인 전 안내는 로그인하면 더 볼 이유가 없습니다
  $('signup').hidden = !!state.session;

  if (!state.session) {
    $('me').innerHTML = '<button class="signin" onclick="openLogin()">로그인</button>';
    return;
  }
  const name = esc(state.session.name);
  const provider = esc(PROVIDER_NAME[state.session.provider] || state.session.provider);
  $('me').innerHTML = `<details class="acct" id="acct"><summary aria-label="내 계정 메뉴"><span class="avatar" aria-hidden="true">${name.slice(0, 1)}</span><span class="who">${name}</span>${CARET}</summary><div class="acctmenu"><span class="name"><b>${name}</b>${provider} 계정</span><button onclick="closeAcct();navigate('saved')">내 짤</button><button class="out" onclick="closeAcct();signOut()">로그아웃</button></div></details>`;
}

export function closeAcct() {
  const el = $('acct');
  if (el) el.open = false;
}

/** 바깥을 누르거나 ESC를 누르면 계정 메뉴를 닫습니다 */
export function initAuth() {
  document.addEventListener('click', e => {
    const el = $('acct');
    if (el && el.open && !el.contains(e.target)) el.open = false;
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const el = $('acct');
    if (el && el.open) { el.open = false; el.querySelector('summary').focus(); }
  });
}

/** 로그인 시트를 엽니다. msg를 주면 왜 로그인이 필요한지 알려줍니다. */
export function openLogin(msg) {
  $('loginsub').textContent = msg || DEFAULT_SUB;
  $('loginbtns').innerHTML = PROVIDERS
    .map(p => `<button class="pvbtn ${p.cls}" onclick="signIn('${p.id}')"><i>${p.mark}</i>${p.label}</button>`)
    .join('');
  $('login').showModal();
}

/**
 * 로그인이 필요한 동작 앞에 세워두는 문지기.
 * 로그인 상태면 true, 아니면 상세 모달을 닫고 로그인 시트를 띄운 뒤 false.
 */
export function requireAuth(msg) {
  if (state.session) return true;
  if ($('modal').open) $('modal').close();
  openLogin(msg);
  return false;
}

export async function signIn(provider) {
  const session = await store.signIn(provider);
  // 서버 모드에서는 공급자 로그인 화면으로 넘어가므로 여기서 끝납니다
  if (!session) return;

  state.session = session;
  const moved = mergeGuest(session.id);
  await reloadData();
  $('login').close();
  renderMe();
  render();
  toast(moved ? `로그인했어요. 담아둔 ${moved}개도 계정으로 옮겼어요` : '로그인했어요');
}

export async function signOut() {
  await store.signOut();
  state.session = null;
  await reloadData();
  renderMe();
  render();
  navigate('explore');
  toast('로그아웃했어요');
}
