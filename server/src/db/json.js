// db/json.js — 기본 저장소. 의존성 없이 JSON 파일 한 장에 담습니다.
// 개발과 시연용입니다. 실서비스는 DB_DRIVER=postgres 로 바꾸세요.
import fs from 'node:fs';
import path from 'node:path';
import { MEME_ROWS } from '../../../web/js/data/index.js';

export function createJsonDb(file) {
  const abs = path.resolve(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  let data = { users: [], memes: [], boards: [], saves: [], reports: [],
               seq: { users: 1, memes: 1, boards: 1 } };
  if (fs.existsSync(abs)) {
    try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch {}
  }
  data.boards = data.boards || [];
  data.sessions = data.sessions || [];
  data.meme_revisions = data.meme_revisions || [];
  data.audit_events = data.audit_events || [];
  data.ai_requests = data.ai_requests || [];
  data.seq.boards = data.seq.boards || 1;

  // 기본 카탈로그 심기 (한 번만)
  if (!data.memes.length) {
    data.memes = MEME_ROWS.map(([id, name, image_path, cat, tags, keywords, why]) => ({
      id, name, image_path, cat, tags, keywords, why, owner_id: null, visibility: 'public',
    }));
    data.seq.memes = Math.max(...data.memes.map(m => m.id)) + 1;
  }

  let dirty = false;
  const save = () => { dirty = true; };
  setInterval(() => {
    if (!dirty) return;
    dirty = false;
    fs.writeFileSync(abs, JSON.stringify(data));
  }, 400).unref();
  process.on('exit', () => { if (dirty) fs.writeFileSync(abs, JSON.stringify(data)); });

  const matches = (m, q) => {
    const hay = [m.name, ...m.tags, ...m.keywords, m.why, m.cat].join(' ').toLowerCase();
    return hay.includes(q.toLowerCase());
  };

  return {
    driver: 'json',

    users: {
      async findOrCreate({ provider, providerId, name, email, avatarUrl }) {
        let u = data.users.find(x => x.provider === provider && x.provider_id === providerId);
        if (!u) {
          u = {
            id: data.seq.users++, provider, provider_id: providerId,
            name, email: email || null, avatar_url: avatarUrl || null,
            created_at: new Date().toISOString(),
          };
          data.users.push(u);
        }
        if (!(provider === 'apple' && name === 'Apple 사용자')) u.name = name;
        if (email) u.email = email;
        u.last_seen_at = new Date().toISOString();
        save();
        return u;
      },
      async byId(id) { return data.users.find(u => u.id === id) || null; },
    },

    sessions: {
      async create(tokenHash, userId, expiresAt) {
        data.sessions = data.sessions.filter(s => Date.parse(s.expires_at) > Date.now());
        data.sessions.push({ token_hash: tokenHash, user_id: userId, expires_at: expiresAt.toISOString() });
        save();
      },
      async userId(tokenHash) {
        const session = data.sessions.find(s => s.token_hash === tokenHash && Date.parse(s.expires_at) > Date.now());
        return session?.user_id ?? null;
      },
      async remove(tokenHash) {
        data.sessions = data.sessions.filter(s => s.token_hash !== tokenHash);
        save();
      },
      async consume(tokenHash) {
        const session = data.sessions.find(s => s.token_hash === tokenHash && Date.parse(s.expires_at) > Date.now());
        if (!session) return null;
        data.sessions = data.sessions.filter(s => s !== session);
        save();
        return session.user_id;
      },
    },

    memes: {
      async list({ cat, q, limit = 200, offset = 0, userId = null } = {}) {
        let rows = data.memes.filter(m => m.owner_id === null || m.owner_id === userId);
        if (cat && cat !== '전체') rows = rows.filter(m => m.cat === cat);
        if (q) rows = rows.filter(m => matches(m, q));
        return { total: rows.length, rows: rows.slice(offset, offset + limit) };
      },
      async byId(id) { return data.memes.find(m => m.id === id) || null; },
      async create(row) {
        const m = { id: data.seq.memes++, visibility: 'private', ...row };
        data.memes.push(m);
        save();
        return m;
      },
      /** 아직 AI가 손대지 않은, 사용자가 올린 짤 */
      async needEnrich(limit = 3) {
        return data.memes.filter(m => m.owner_id !== null && !m.enriched_at).slice(0, limit);
      },
      /** out이 null이면 '해봤지만 실패' 표시만 남깁니다 */
      async markEnriched(id, out) {
        const m = data.memes.find(x => x.id === id);
        if (!m) return false;
        if (out) {
          const beforeState = { name: m.name, cat: m.cat, tags: m.tags,
            keywords: m.keywords, why: m.why };
          const afterState = { name: out.name, cat: out.cat, tags: out.tags,
            keywords: out.keywords, why: out.why };
          if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
            data.meme_revisions.push({ meme_id: id, actor_type: 'ai',
              before_state: beforeState, after_state: afterState, created_at: new Date().toISOString() });
          }
          m.name = out.name;
          m.cat = out.cat;
          m.tags = out.tags;
          m.keywords = out.keywords;
          m.why = out.why;
        }
        m.enriched_at = new Date().toISOString();
        m.updated_at = m.enriched_at;
        save();
        return true;
      },
      async remove(id, ownerId) {
        const i = data.memes.findIndex(m => m.id === id && m.owner_id === ownerId);
        if (i < 0) return false;
        data.memes.splice(i, 1);
        data.saves = data.saves.filter(s => s.meme_id !== id);
        save();
        return true;
      },
    },

    boards: {
      async list(userId) {
        return data.boards.filter(b => b.user_id === userId)
          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      },
      async byId(id, userId) {
        return data.boards.find(b => b.id === id && b.user_id === userId) || null;
      },
      async create(userId, { name, isPrivate }) {
        const now = new Date().toISOString();
        const b = {
          id: data.seq.boards++, user_id: userId, name,
          is_private: !!isPrivate, created_at: now, updated_at: now,
        };
        data.boards.push(b);
        save();
        return b;
      },
      async rename(id, userId, name) {
        const b = data.boards.find(x => x.id === id && x.user_id === userId);
        if (!b) return false;
        b.name = name;
        b.updated_at = new Date().toISOString();
        save();
        return true;
      },
      async remove(id, userId) {
        const i = data.boards.findIndex(b => b.id === id && b.user_id === userId);
        if (i < 0) return false;
        data.boards.splice(i, 1);
        data.saves = data.saves.filter(s => s.board_id !== id);   // 저장함과 함께 핀도
        save();
        return true;
      },
      touch(id) {
        const b = data.boards.find(x => x.id === id);
        if (b) { b.updated_at = new Date().toISOString(); save(); }
      },
    },

    saves: {
      /** 이 사람이 담아둔 것 전부 — 어느 저장함에 담았는지까지 */
      async list(userId) {
        return data.saves.filter(s => s.user_id === userId)
          .map(s => ({ meme_id: s.meme_id, board_id: s.board_id, at: s.created_at }));
      },
      /** boardId가 null이면 저장함 없이 저장 */
      async add(userId, boardId, memeId) {
        if (!data.saves.some(s => s.user_id === userId && s.board_id === boardId && s.meme_id === memeId)) {
          data.saves.push({
            user_id: userId, board_id: boardId, meme_id: memeId,
            created_at: new Date().toISOString(),
          });
          save();
        }
      },
      /** 그 자리에서만 빼기 — boardId가 null이면 '저장함 없이' 자리 */
      async remove(userId, boardId, memeId) {
        data.saves = data.saves.filter(s => !(
          s.user_id === userId && s.meme_id === memeId && s.board_id === boardId));
        save();
      },
      /** 어디에 담겼든 전부 */
      async clear(userId, memeId) {
        data.saves = data.saves.filter(s => !(s.user_id === userId && s.meme_id === memeId));
        save();
      },
    },

    reports: {
      async list(userId) {
        return data.reports
          .filter(r => r.user_id === userId)
          .map(r => ({ meme_id: r.meme_id, reason: r.reason, at: r.created_at }));
      },
      async add(userId, memeId, reason) {
        const found = data.reports.find(r => r.user_id === userId && r.meme_id === memeId);
        if (found) { found.reason = reason; found.status = 'open'; found.updated_at = new Date().toISOString(); }
        else data.reports.push({ user_id: userId, meme_id: memeId, reason, status: 'open', created_at: new Date().toISOString() });
        save();
      },
      async remove(userId, memeId) {
        data.reports = data.reports.filter(r => !(r.user_id === userId && r.meme_id === memeId));
        save();
      },
    },

    audit: {
      async record({ userId = null, action, targetType, targetId = null, metadata = {} }) {
        data.audit_events.push({ actor_user_id: userId, action, target_type: targetType,
          target_id: targetId == null ? null : String(targetId), metadata, created_at: new Date().toISOString() });
        save();
      },
    },

    aiRequests: {
      async record(row) {
        data.ai_requests.push({ ...row, created_at: new Date().toISOString() });
        save();
      },
    },
  };
}
