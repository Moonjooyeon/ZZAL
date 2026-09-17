// db/postgres.js — 운영용 저장소. json.js와 같은 인터페이스를 구현합니다.
// 쓰려면: npm i pg  + DB_DRIVER=postgres + DATABASE_URL
// 테이블은 schema.sql 로 먼저 만들어 두세요.

export async function createPostgresDb(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  const one = async (sql, args) => (await pool.query(sql, args)).rows[0] || null;
  const many = async (sql, args) => (await pool.query(sql, args)).rows;

  return {
    driver: 'postgres',
    pool,

    users: {
      async findOrCreate({ provider, providerId, name, email, avatarUrl }) {
        return one(`
          INSERT INTO users (provider, provider_id, name, email, avatar_url)
          VALUES ($1,$2,$3,$4,$5)
          ON CONFLICT (provider, provider_id) DO UPDATE
            SET name = EXCLUDED.name, last_seen_at = now()
          RETURNING *`, [provider, providerId, name, email || null, avatarUrl || null]);
      },
      async byId(id) { return one('SELECT * FROM users WHERE id = $1', [id]); },
    },

    memes: {
      async list({ cat, q, limit = 200, offset = 0, userId = null } = {}) {
        const where = ['(owner_id IS NULL OR owner_id = $1)'];
        const args = [userId];
        if (cat && cat !== '전체') { args.push(cat); where.push(`cat = $${args.length}`); }
        if (q) {
          args.push(q);
          where.push(`to_tsvector('simple',
            name || ' ' || array_to_string(tags,' ') || ' ' ||
            array_to_string(keywords,' ') || ' ' || why)
            @@ plainto_tsquery('simple', $${args.length})`);
        }
        const clause = 'WHERE ' + where.join(' AND ');
        const total = Number((await one(`SELECT count(*)::int AS n FROM memes ${clause}`, args)).n);
        args.push(limit, offset);
        const rows = await many(
          `SELECT * FROM memes ${clause} ORDER BY id LIMIT $${args.length - 1} OFFSET $${args.length}`, args);
        return { total, rows };
      },
      async byId(id) { return one('SELECT * FROM memes WHERE id = $1', [id]); },
      async create(row) {
        return one(`
          INSERT INTO memes (name, image_path, cat, tags, keywords, why, owner_id, visibility)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [row.name, row.image_path, row.cat, row.tags, row.keywords, row.why, row.owner_id, row.visibility || 'private']);
      },
      async remove(id, ownerId) {
        const r = await pool.query('DELETE FROM memes WHERE id = $1 AND owner_id = $2', [id, ownerId]);
        return r.rowCount > 0;
      },
    },

    boards: {
      async list(userId) {
        return many('SELECT * FROM boards WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
      },
      async byId(id, userId) {
        return one('SELECT * FROM boards WHERE id = $1 AND user_id = $2', [id, userId]);
      },
      async create(userId, { name, isPrivate }) {
        return one(`INSERT INTO boards (user_id, name, is_private)
                    VALUES ($1,$2,$3) RETURNING *`, [userId, name, !!isPrivate]);
      },
      async rename(id, userId, name) {
        const r = await pool.query(
          'UPDATE boards SET name = $3, updated_at = now() WHERE id = $1 AND user_id = $2',
          [id, userId, name]);
        return r.rowCount > 0;
      },
      async remove(id, userId) {
        // saves는 board_id에 ON DELETE CASCADE가 걸려 있어 같이 지워집니다
        const r = await pool.query('DELETE FROM boards WHERE id = $1 AND user_id = $2', [id, userId]);
        return r.rowCount > 0;
      },
      async touch(id) {
        await pool.query('UPDATE boards SET updated_at = now() WHERE id = $1', [id]);
      },
    },

    saves: {
      async list(userId) {
        return (await many(
          `SELECT meme_id, board_id, created_at AS at FROM saves
           WHERE user_id = $1 ORDER BY created_at DESC`, [userId]))
          .map(r => ({ meme_id: Number(r.meme_id), board_id: Number(r.board_id), at: r.at }));
      },
      async add(userId, boardId, memeId) {
        await pool.query(
          `INSERT INTO saves (user_id, board_id, meme_id) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`, [userId, boardId, memeId]);
      },
      async remove(userId, boardId, memeId) {
        await (boardId === null
          ? pool.query('DELETE FROM saves WHERE user_id = $1 AND meme_id = $2', [userId, memeId])
          : pool.query('DELETE FROM saves WHERE user_id = $1 AND board_id = $2 AND meme_id = $3',
              [userId, boardId, memeId]));
      },
    },

    reports: {
      async list(userId) {
        return (await many(
          'SELECT meme_id, reason, created_at AS at FROM reports WHERE user_id = $1', [userId]))
          .map(r => ({ meme_id: Number(r.meme_id), reason: r.reason, at: r.at }));
      },
      async add(userId, memeId, reason) {
        await pool.query(`
          INSERT INTO reports (user_id, meme_id, reason) VALUES ($1,$2,$3)
          ON CONFLICT (user_id, meme_id) DO UPDATE SET reason = EXCLUDED.reason`,
          [userId, memeId, reason]);
      },
      async remove(userId, memeId) {
        await pool.query('DELETE FROM reports WHERE user_id = $1 AND meme_id = $2', [userId, memeId]);
      },
    },
  };
}
