// core/api.js — 데이터 계층. 화면은 이 인터페이스만 알고, 어디에 저장되는지는 모릅니다.
//
//   getSession()                 → 로그인 정보 또는 null
//   signIn(provider)             → 세션. null이면 공급자 화면으로 넘어간 것
//   signOut()
//   load()                       → { boards:[], pins:[], mine:[], reported:{} }
//   createBoard({name,private})  → 만들어진 저장함
//   renameBoard(id, name)
//   deleteBoard(id)              → 저장함과 그 안의 핀을 같이 지웁니다
//   addPin(memeId, boardId)      → 저장함에 담기. boardId가 null이면 저장함 없이 저장
//   removePin(memeId, boardId)   → 그 자리에서만 빼기 (null이면 '저장함 없이' 자리)
//   clearPins(memeId)            → 어디에 담겼든 전부 빼기
//   assistSearch(q)              → 못 찾았을 때 AI에게 검색어를 다시 물어보기.
//                                  AI가 없으면 null (그냥 '없음'으로 끝납니다)
//   addUpload({name, image})     → 만들어진 짤. null이면 실패
//   removeUpload(id)
//   setReport(id, reason|null)   → 신고/숨김 해제
//
// localStore = 브라우저에만 저장 (기본, 정적 배포용)
// remoteStore = server/ 의 API 호출 (core/config.js 에서 켬)
// 테이블 대응: users / memes / saves / uploads / reports — SCHEMA.md 참고
import { state } from './state.js';
import { toast } from './dom.js';
import { API_BASE, USE_API } from './config.js';

export const PROVIDERS = [
  { id: 'kakao', label: '카카오로 시작하기', cls: 'pv-kakao', mark: 'K' },
  { id: 'google', label: 'Google로 시작하기', cls: 'pv-google', mark: 'G' },
];
export const PROVIDER_NAME = { kakao: '카카오', google: 'Google' };

// ── 브라우저 저장 ──────────────────────────────────────────────────────────
/** 사용자별로 키를 나눈 localStorage 래퍼 */
const ls = {
  key: (name, uid) => `zzal.u.${uid}.${name}`,
  read(name, uid, fallback) {
    try {
      const v = localStorage.getItem(this.key(name, uid));
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  write(name, uid, value) {
    try {
      localStorage.setItem(this.key(name, uid), JSON.stringify(value));
      return true;
    } catch {
      toast('브라우저에 저장할 수 없어요. 이 화면에서만 유지됩니다.');
      return false;
    }
  },
};

const uid = () => (state.session ? state.session.id : 'guest');

const touchBoard = (u, boardId) => ls.write('boards', u,
  ls.read('boards', u, []).map(b => b.id === boardId ? { ...b, updatedAt: Date.now() } : b));

/** 저장함이 없던 시절의 평평한 saved 목록을 기본 저장함 하나로 옮깁니다 */
function migrateFlatSaves(u) {
  const old = ls.read('saved', u, null);
  if (!Array.isArray(old)) return;
  if (old.length) {
    // 저장함이 없던 시절에 담아둔 것 — '저장함 없이' 자리로 옮깁니다
    const pins = ls.read('pins', u, []);
    const have = new Set(pins.filter(p => p.b === null).map(p => p.m));
    ls.write('pins', u, [...pins,
      ...old.filter(m => !have.has(m)).map(m => ({ m, b: null, at: Date.now() }))]);
  }
  try { localStorage.removeItem(ls.key('saved', u)); } catch {}
}

const localStore = {
  mode: 'local',

  async getSession() {
    try { return JSON.parse(localStorage.getItem('zzal.session') || 'null'); }
    catch { return null; }
  },
  async signIn(provider) {
    const s = {
      id: provider + ':demo',
      provider,
      name: PROVIDER_NAME[provider] + ' 사용자',
      at: Date.now(),
    };
    try { localStorage.setItem('zzal.session', JSON.stringify(s)); } catch {}
    return s;
  },
  async signOut() {
    try { localStorage.removeItem('zzal.session'); } catch {}
  },

  async load() {
    const u = uid();
    migrateFlatSaves(u);
    return {
      boards: ls.read('boards', u, []),
      pins: ls.read('pins', u, []),
      mine: ls.read('mine', u, []),
      reported: ls.read('reported', u, {}),
    };
  },

  async createBoard({ name, private: isPrivate }) {
    const u = uid();
    const board = {
      id: 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name, private: !!isPrivate, at: Date.now(), updatedAt: Date.now(),
    };
    if (!ls.write('boards', u, [...ls.read('boards', u, []), board])) return null;
    return board;
  },
  async renameBoard(id, name) {
    const u = uid();
    const boards = ls.read('boards', u, []).map(b =>
      b.id === id ? { ...b, name, updatedAt: Date.now() } : b);
    return ls.write('boards', u, boards);
  },
  async deleteBoard(id) {
    const u = uid();
    ls.write('pins', u, ls.read('pins', u, []).filter(p => p.b !== id));
    return ls.write('boards', u, ls.read('boards', u, []).filter(b => b.id !== id));
  },

  async addPin(memeId, boardId) {
    const u = uid();
    const pins = ls.read('pins', u, []);
    if (pins.some(p => p.m === memeId && p.b === boardId)) return true;
    if (!ls.write('pins', u, [...pins, { m: memeId, b: boardId, at: Date.now() }])) return false;
    if (boardId) touchBoard(u, boardId);
    return true;
  },
  async removePin(memeId, boardId) {
    const u = uid();
    const left = ls.read('pins', u, []).filter(p => !(p.m === memeId && p.b === boardId));
    if (!ls.write('pins', u, left)) return false;
    if (boardId) touchBoard(u, boardId);
    return true;
  },
  async clearPins(memeId) {
    const u = uid();
    return ls.write('pins', u, ls.read('pins', u, []).filter(p => p.m !== memeId));
  },
  // 브라우저에만 저장할 때는 AI가 없습니다 (키는 서버에만 둡니다)
  async assistSearch() { return null; },
  async addUpload(z) {
    const mine = ls.read('mine', uid(), []);
    if (!ls.write('mine', uid(), [...mine, z])) return null;
    return z;
  },
  async removeUpload(id) {
    return ls.write('mine', uid(), ls.read('mine', uid(), []).filter(m => m.id !== id));
  },
  async setReport(id, reason) {
    const all = ls.read('reported', uid(), {});
    if (reason === null) delete all[id];
    else all[id] = { reason, at: Date.now() };
    return ls.write('reported', uid(), all);
  },
};

// ── 서버 저장 ─────────────────────────────────────────────────────────────
const call = async (path, init) => {
  const res = await fetch(API_BASE + path, { credentials: 'include', ...init });
  if (res.status === 401) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `요청에 실패했어요 (${res.status})`);
  }
  return res.status === 204 ? true : res.json();
};
const send = (method, path, body) => call(path, {
  method,
  headers: body ? { 'content-type': 'application/json' } : undefined,
  body: body ? JSON.stringify(body) : undefined,
});

const remoteStore = {
  mode: 'api',

  async getSession() {
    const r = await call('/api/auth/me');
    return r && r.user ? r.user : null;
  },
  async signIn(provider) {
    // OAuth는 공급자 화면으로 넘어갔다가 돌아옵니다. 여기서 반환되지 않습니다.
    location.href = `${API_BASE}/api/auth/${provider}`;
    return null;
  },
  async signOut() { await send('POST', '/api/auth/logout'); },

  async load() {
    const none = { boards: [], pins: [], mine: [], reported: {} };
    if (!state.session) return none;
    const [boards, uploads, reports] = await Promise.all([
      call('/api/me/boards'), call('/api/me/uploads'), call('/api/me/reports'),
    ]);
    if (!boards) return none;   // 그 사이 세션이 끊긴 경우
    const reported = {};
    (reports.reports || []).forEach(r => { reported[r.meme_id] = { reason: r.reason, at: r.at }; });
    return {
      boards: (boards.boards || []).map(toBoard),
      pins: (boards.pins || []).map(p => ({
        m: p.meme_id,
        b: p.board_id == null ? null : String(p.board_id),
        at: p.at,
      })),
      mine: (uploads.uploads || []).map(toMeme),
      reported,
    };
  },

  async createBoard({ name, private: isPrivate }) {
    const r = await send('POST', '/api/me/boards', { name, private: !!isPrivate });
    return r ? toBoard(r.board) : null;
  },
  async renameBoard(id, name) {
    await send('PATCH', `/api/me/boards/${id}`, { name });
    return true;
  },
  async deleteBoard(id) {
    await send('DELETE', `/api/me/boards/${id}`);
    return true;
  },
  async addPin(memeId, boardId) {
    await (boardId === null
      ? send('PUT', `/api/me/pins/${memeId}`)
      : send('PUT', `/api/me/boards/${boardId}/pins/${memeId}`));
    return true;
  },
  async removePin(memeId, boardId) {
    await (boardId === null
      ? send('DELETE', `/api/me/pins/${memeId}`)
      : send('DELETE', `/api/me/boards/${boardId}/pins/${memeId}`));
    return true;
  },
  async clearPins(memeId) {
    await send('DELETE', `/api/me/saves/${memeId}`);
    return true;
  },
  async assistSearch(q) {
    try {
      const r = await send('POST', '/api/search/assist', { q });
      return r && r.enabled && r.terms.length ? r : null;
    } catch { return null; }
  },
  async addUpload(z) {
    const r = await send('POST', '/api/me/uploads', { name: z.name, image: z.src });
    return r ? toMeme(r.meme) : null;
  },
  async removeUpload(id) {
    await send('DELETE', `/api/me/uploads/${id}`);
    return true;
  },
  async setReport(id, reason) {
    await (reason === null
      ? send('DELETE', `/api/me/reports/${id}`)
      : send('PUT', `/api/me/reports/${id}`, { reason }));
    return true;
  },
};

/** 서버 응답 → 화면이 쓰는 저장함 객체 */
const toBoard = b => ({
  id: String(b.id),
  name: b.name,
  private: !!b.is_private,
  at: new Date(b.created_at || Date.now()).getTime(),
  updatedAt: new Date(b.updated_at || b.created_at || Date.now()).getTime(),
});

/** 서버 응답 → 화면이 쓰는 짤 객체 */
const toMeme = m => ({
  id: Number(m.id),
  name: m.name,
  src: m.src || m.image_path,
  filename: String(m.src || m.image_path || '').split('/').pop(),
  cat: m.cat,
  tags: m.tags || [],
  kw: [m.name, ...(m.tags || [])],
  why: m.why || m.name,
  art: `<img src="${m.src || m.image_path}" alt="${m.name}">`,
});

export const store = USE_API ? remoteStore : localStore;

// ── 공통 ──────────────────────────────────────────────────────────────────
/** 내 데이터를 다시 읽어 상태에 싣습니다 (로그인/로그아웃 직후) */
export async function reloadData() {
  const d = await store.load();
  state.boards = d.boards;
  state.pins = d.pins;
  state.mine = d.mine;
  state.reported = d.reported;
  refreshSaved();
}

/** pins를 바꾼 뒤에는 반드시 불러야 합니다 — 카드의 저장 표시가 여기서 나옵니다 */
export function refreshSaved() {
  state.saved = new Set(state.pins.map(p => p.m));
}

/** 로그인 개념이 없던 시절의 zzal.saved / zzal.mine / zzal.reported 를 guest 칸으로 */
export function migrateLegacy() {
  if (USE_API) return;
  ['saved', 'mine', 'reported'].forEach(name => {
    try {
      const v = localStorage.getItem('zzal.' + name);
      if (v === null) return;
      if (localStorage.getItem(ls.key(name, 'guest')) === null) {
        localStorage.setItem(ls.key(name, 'guest'), v);
      }
      localStorage.removeItem('zzal.' + name);
    } catch {}
  });
}

/** 로그인 안 한 채로 담아둔 것을 계정으로 옮깁니다. 옮긴 개수를 돌려줍니다. */
export function mergeGuest(accountId) {
  if (USE_API) return 0;   // 서버를 쓰면 게스트 칸 자체가 없습니다
  migrateFlatSaves('guest');
  const g = {
    boards: ls.read('boards', 'guest', []),
    pins: ls.read('pins', 'guest', []),
    mine: ls.read('mine', 'guest', []),
    reported: ls.read('reported', 'guest', {}),
  };
  const moved = g.pins.length + g.mine.length + Object.keys(g.reported).length;
  if (!moved) return 0;

  const a = {
    boards: ls.read('boards', accountId, []),
    pins: ls.read('pins', accountId, []),
    mine: ls.read('mine', accountId, []),
    reported: ls.read('reported', accountId, {}),
  };
  const haveBoard = new Set(a.boards.map(b => b.id));
  ls.write('boards', accountId, [...a.boards, ...g.boards.filter(b => !haveBoard.has(b.id))]);

  const havePin = new Set(a.pins.map(p => p.m + '@' + p.b));
  ls.write('pins', accountId, [...a.pins, ...g.pins.filter(p => !havePin.has(p.m + '@' + p.b))]);

  const have = new Set(a.mine.map(m => m.id));
  ls.write('mine', accountId, [...a.mine, ...g.mine.filter(m => !have.has(m.id))]);
  ls.write('reported', accountId, { ...g.reported, ...a.reported });

  ['boards', 'pins', 'mine', 'reported'].forEach(k => {
    try { localStorage.removeItem(ls.key(k, 'guest')); } catch {}
  });
  return moved;
}
