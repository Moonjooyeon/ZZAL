// app.js — 엔트리. 모듈을 엮고, 부팅하고, 마크업이 부르는 함수를 window에 걸어둡니다.
import { store, reloadData, migrateLegacy } from './core/api.js';
import { state } from './core/state.js';

import { renderMe, openLogin, signIn, signOut, closeAcct, initAuth } from './features/auth.js';
import { render, navigate, query, resetFeed, initFeed } from './features/feed.js';
import { openDetail, openFromUrl, download, copyText, initDetail } from './features/detail.js';
import { toggle } from './features/saves.js';
import { openShare, openWin, nativeShare, copyShareUrl } from './features/share.js';
import { askDelete, askReport, unreport } from './features/moderation.js';
import { cancelDraft, initUpload } from './features/upload.js';
import { openBoard, closeBoard, openBoardForm, askDeleteBoard, openPicker, unpinFrom, unpinAll, onPickChange, currentPick, initBoards } from './features/boards.js';

// ── 인라인 핸들러 다리 ─────────────────────────────────────────────────────
// 카드·상세·공유 시트는 HTML 문자열로 만들고 onclick="..." 으로 연결합니다.
// 그 문자열은 전역에서만 함수를 찾을 수 있어서, 여기서 한 번에 노출합니다.
// (이벤트 위임으로 바꾸면 이 블록을 통째로 지울 수 있습니다)
Object.assign(window, {
  navigate, query, resetFeed,
  openDetail, download, copyText,
  toggle,
  openShare, openWin, nativeShare, copyShareUrl,
  askDelete, askReport, unreport,
  openLogin, signIn, signOut, closeAcct,
  cancelDraft,
  openBoard, closeBoard, openBoardForm, askDeleteBoard, openPicker, unpinFrom, unpinAll, onPickChange,
  // 인라인 핸들러가 지금 상태를 물어볼 때 쓰는 작은 창구
  zzalOpenBoard: () => state.openBoard,
  zzalPicking: currentPick,
});

// ── 부팅 ──────────────────────────────────────────────────────────────────
migrateLegacy();
initAuth();
initBoards();
initFeed();
initDetail();
initUpload();

(async () => {
  state.session = await store.getSession();
  await reloadData();
  renderMe();
  render();
  openFromUrl();
})();
