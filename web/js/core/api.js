// core/api.js — 데이터 계층. 화면은 이 인터페이스만 알고, 어디에 저장되는지는 모릅니다.
//
//   getSession()                 → 로그인 정보 또는 null
//   signIn(provider)             → 세션. null이면 공급자 화면으로 넘어간 것
//   signOut()
//   load()                       → { saved:number[], mine:[], reported:{} }
//   setSaved(id, on)             → 저장/취소
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
    return {
      saved: ls.read('saved', u, []),
      mine: ls.read('mine', u, []),
      reported: ls.read('reported', u, {}),
    };
  },
  async setSaved(id, on) {
    const next = new Set(ls.read('saved', uid(), []));
    on ? next.add(id) : next.delete(id);
    return ls.write('saved', uid(), [...next]);
  },
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
    if (!state.session) return { saved: [], mine: [], reported: {} };
    const [saves, uploads, reports] = await Promise.all([
      call('/api/me/saves'), call('/api/me/uploads'), call('/api/me/reports'),
    ]);
    if (!saves) return { saved: [], mine: [], reported: {} };   // 그 사이 세션이 끊긴 경우
    const reported = {};
    (reports.reports || []).forEach(r => { reported[r.meme_id] = { reason: r.reason, at: r.at }; });
    return {
      saved: saves.saved,
      mine: (uploads.uploads || []).map(toMeme),
      reported,
    };
  },
  async setSaved(id, on) {
    await send(on ? 'PUT' : 'DELETE', `/api/me/saves/${id}`);
    return true;
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

/** 서버 응답 → 화면이 쓰는 짤 객체 */
const toMeme = m => ({
  id: m.id,
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
  state.saved = new Set(d.saved);
  state.mine = d.mine;
  state.reported = d.reported;
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
  const g = {
    saved: ls.read('saved', 'guest', []),
    mine: ls.read('mine', 'guest', []),
    reported: ls.read('reported', 'guest', {}),
  };
  const moved = g.saved.length + g.mine.length + Object.keys(g.reported).length;
  if (!moved) return 0;

  const a = {
    saved: ls.read('saved', accountId, []),
    mine: ls.read('mine', accountId, []),
    reported: ls.read('reported', accountId, {}),
  };
  ls.write('saved', accountId, [...new Set([...a.saved, ...g.saved])]);

  const have = new Set(a.mine.map(m => m.id));
  ls.write('mine', accountId, [...a.mine, ...g.mine.filter(m => !have.has(m.id))]);
  ls.write('reported', accountId, { ...g.reported, ...a.reported });

  ['saved', 'mine', 'reported'].forEach(k => {
    try { localStorage.removeItem(ls.key(k, 'guest')); } catch {}
  });
  return moved;
}
