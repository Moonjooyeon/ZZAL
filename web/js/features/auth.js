// features/auth.js — 로그인/로그아웃. Apple·Google 소셜 로그인.
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
  $('me').innerHTML = `<details class="acct" id="acct"><summary aria-label="내 계정 메뉴"><span class="avatar" aria-hidden="true">${name.slice(0, 1)}</span><span class="who">${name}</span>${CARET}</summary><div class="acctmenu"><span class="name"><b>${name}</b>${provider} 계정</span><button onclick="closeAcct();navigate('saved')">내 짤</button><button class="out" onclick="closeAcct();signOut()">로그아웃</button><button class="delete-account" onclick="openDeleteAccount()">계정 삭제</button></div></details>`;
}

export function closeAcct() {
  const el = $('acct');
  if (el) el.open = false;
}

export function openDeleteAccount() {
  closeAcct();
  $('deleteaccount').showModal();
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
  $('deleteaccountform').addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('deleteaccountsubmit');
    button.disabled = true;
    button.textContent = '삭제 중…';
    try {
      const removed = await store.deleteAccount();
      if (!removed) throw new Error('계정을 삭제하지 못했어요');
      state.session = null;
      await reloadData();
      $('deleteaccount').close();
      renderMe();
      render();
      navigate('explore');
      toast('계정과 저장된 데이터가 삭제됐어요');
    } catch (error) {
      toast(error.message || '계정을 삭제하지 못했어요. 다시 시도해 주세요.');
    } finally {
      button.disabled = false;
      button.textContent = '계정 영구 삭제';
    }
  });
}

/** 로그인 시트를 엽니다. msg를 주면 왜 로그인이 필요한지 알려줍니다. */
export function openLogin(msg) {
  $('loginsub').textContent = msg || DEFAULT_SUB;
  $('loginbtns').innerHTML = PROVIDERS
    .map(p => `<button type="button" class="pvbtn ${p.cls}" onclick="signIn('${p.id}')">${p.icon ? `<img class="pv-logo" src="${p.icon}" alt="" aria-hidden="true">` : `<i aria-hidden="true">${p.mark}</i>`}<span>${p.label}</span></button>`)
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
