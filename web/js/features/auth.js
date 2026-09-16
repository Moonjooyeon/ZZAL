// features/auth.js — 로그인/로그아웃. 카카오·구글 소셜 로그인.
//
// 지금은 core/api.js 의 store.signIn 이 데모 세션을 만듭니다.
// 실제 연동은 server/src/auth/ 의 OAuth 라우트로 리다이렉트하도록 store만 바꾸면 됩니다.
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store, reloadData, mergeGuest, PROVIDERS } from '../core/api.js';
import { render, navigate } from './feed.js';

const DEFAULT_SUB = '저장한 짤과 올린 짤을 어느 기기에서든 그대로 꺼내 볼 수 있어요.';

/** 헤더 오른쪽: 로그인 버튼 또는 프로필 */
export function renderMe() {
  $('me').innerHTML = state.session
    ? `<span class="avatar" aria-hidden="true">${esc(state.session.name.slice(0, 1))}</span><span class="who">${esc(state.session.name)}</span><button class="out" onclick="signOut()">로그아웃</button>`
    : '<button class="signin" onclick="openLogin()">로그인</button>';
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
