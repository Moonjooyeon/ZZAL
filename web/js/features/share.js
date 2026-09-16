// features/share.js — 짤 하나를 SNS로 공유. 카카오톡은 SDK 없이 기기 공유 시트를 씁니다.
import { $, esc, toast } from '../core/dom.js';
import { byId, title, isMine } from '../core/catalog.js';

const ICONS = {
  link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/></svg>',
};

export function shareUrl(id) {
  const base = location.protocol.startsWith('http')
    ? location.origin + location.pathname
    : location.href.split(/[?#]/)[0];
  return base + '?z=' + id;
}

const shareText = z => `“${title(z)}” · 이짤이이짤`;

export function openShare(id) {
  const z = byId(id);
  if (!z) return;
  const url = shareUrl(id);
  const txt = shareText(z);
  const q = JSON.stringify;   // onclick 문자열에 안전하게 끼워 넣기
  $('shareurl').value = url;

  const buttons = [
    ['ic-link', ICONS.link, '링크 복사', 'copyShareUrl()'],
    ['ic-x', '𝕏', 'X(트위터)', `openWin('https://twitter.com/intent/tweet?text='+encodeURIComponent(${q(txt)})+'&url='+encodeURIComponent(${q(url)}))`],
    ['ic-fb', 'f', '페이스북', `openWin('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(${q(url)}))`],
    ['ic-mail', ICONS.mail, '이메일', `location.href='mailto:?subject='+encodeURIComponent(${q(txt)})+'&body='+encodeURIComponent(${q(txt + '\n' + url)})`],
    ['ic-kakao', 'TALK', '카카오톡', `nativeShare(${id},true)`],
    ['ic-more', ICONS.more, '더보기', `nativeShare(${id},false)`],
  ];
  $('sharerow').innerHTML = buttons
    .map(([cls, icon, label, fn]) => `<button class="sharebtn" onclick="${esc(fn)}"><i class="${cls}">${icon}</i>${label}</button>`)
    .join('');

  $('sharenote').textContent = isMine(z)
    ? '내가 올린 짤은 이 브라우저에만 저장돼 있어서, 링크를 받은 사람에게는 보이지 않아요.'
    : (location.protocol.startsWith('http') ? '' : '로컬 파일로 열어서 링크가 임시 주소입니다. 배포 후에는 실제 주소로 만들어져요.');
  $('share').showModal();
}

export function openWin(url) {
  window.open(url, '_blank', 'noopener,noreferrer,width=600,height=520');
}

/** 기기 공유 시트. 없으면 링크 복사로 떨어집니다 (카카오톡 경로) */
export async function nativeShare(id, kakao) {
  const z = byId(id);
  if (!z) return;
  const url = shareUrl(id);
  const text = shareText(z);
  if (navigator.share) {
    try { await navigator.share({ title: title(z), text, url }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  await copyShareUrl(kakao ? '링크를 복사했어요. 카카오톡에 붙여넣어 보내주세요' : '링크를 복사했어요');
}

export async function copyShareUrl(msg) {
  const url = $('shareurl').value;
  try {
    await navigator.clipboard.writeText(url);
    toast(msg || '링크를 복사했어요');
  } catch {
    const a = $('shareurl');
    a.removeAttribute('readonly');
    a.select();
    const ok = document.execCommand('copy');
    a.setAttribute('readonly', '');
    toast(ok ? (msg || '링크를 복사했어요') : '복사하지 못했어요. 주소를 직접 선택해주세요');
  }
}
