// db/json.js — 기본 저장소. 의존성 없이 JSON 파일 한 장에 담습니다.
// 개발과 시연용입니다. 실서비스는 DB_DRIVER=postgres 로 바꾸세요.
import fs from 'node:fs';
import path from 'node:path';
import { MEME_ROWS } from '../../../web/js/data/index.js';

export function createJsonDb(file) {
  const abs = path.resolve(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  let data = { users: [], memes: [], saves: [], reports: [], seq: { users: 1, memes: 1 } };
  if (fs.existsSync(abs)) {
    try { data = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch {}
  }

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
        u.last_seen_at = new Date().toISOString();
        save();
        return u;
      },
      async byId(id) { return data.users.find(u => u.id === id) || null; },
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
      async remove(id, ownerId) {
        const i = data.memes.findIndex(m => m.id === id && m.owner_id === ownerId);
        if (i < 0) return false;
        data.memes.splice(i, 1);
        data.saves = data.saves.filter(s => s.meme_id !== id);
        save();
        return true;
      },
    },

    saves: {
      async list(userId) {
        return data.saves.filter(s => s.user_id === userId).map(s => s.meme_id);
      },
      async add(userId, memeId) {
        if (!data.saves.some(s => s.user_id === userId && s.meme_id === memeId)) {
          data.saves.push({ user_id: userId, meme_id: memeId, created_at: new Date().toISOString() });
          save();
        }
      },
      async remove(userId, memeId) {
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
        if (found) { found.reason = reason; }
        else data.reports.push({ user_id: userId, meme_id: memeId, reason, status: 'open', created_at: new Date().toISOString() });
        save();
      },
      async remove(userId, memeId) {
        data.reports = data.reports.filter(r => !(r.user_id === userId && r.meme_id === memeId));
        save();
      },
    },
  };
}
