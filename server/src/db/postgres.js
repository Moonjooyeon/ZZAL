// db/postgres.js — 운영용 저장소. json.js와 같은 인터페이스를 구현합니다.
// 쓰려면: npm i pg  + DB_DRIVER=postgres + DATABASE_URL
// 첫 설치는 schema.sql, 이후 변경은 migrations/*.sql 을 부팅 시 적용합니다.
import { MEME_ROWS } from '../../../web/js/data/index.js';
import { migrate } from './migrate.js';

async function seedCatalog(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT count(*)::int AS n FROM memes');
    if (rows[0].n === 0) {
      for (const [id, name, image_path, cat, tags, keywords, why] of MEME_ROWS) {
        await client.query(`INSERT INTO memes
          (id, name, image_path, cat, tags, keywords, why, owner_id, visibility)
          VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'public')`,
          [id, name, image_path, cat, tags, keywords, why]);
      }
      await client.query(`SELECT setval(pg_get_serial_sequence('memes','id'),
        GREATEST((SELECT max(id) FROM memes), 1), true)`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function createPostgresDb(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url });
  await pool.query('SELECT 1');
  await seedCatalog(pool);
  await migrate(pool);
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
            SET name = CASE WHEN EXCLUDED.provider = 'apple' AND EXCLUDED.name = 'Apple 사용자'
              THEN users.name ELSE EXCLUDED.name END,
              email = COALESCE(EXCLUDED.email, users.email), last_seen_at = now()
          RETURNING *`, [provider, providerId, name, email || null, avatarUrl || null]);
      },
      async byId(id) { return one('SELECT * FROM users WHERE id = $1', [id]); },
      async remove(id) {
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        return result.rowCount > 0;
      },
    },

    sessions: {
      async create(tokenHash, userId, expiresAt) {
        await pool.query('DELETE FROM auth_sessions WHERE expires_at <= now()');
        await pool.query('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)',
          [tokenHash, userId, expiresAt]);
      },
      async userId(tokenHash) {
        const row = await one('SELECT user_id FROM auth_sessions WHERE token_hash = $1 AND expires_at > now()', [tokenHash]);
        return row?.user_id ?? null;
      },
      async remove(tokenHash) {
        await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
      },
      async consume(tokenHash) {
        const row = await one('DELETE FROM auth_sessions WHERE token_hash = $1 AND expires_at > now() RETURNING user_id', [tokenHash]);
        return row?.user_id ?? null;
      },
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
          INSERT INTO memes (name, image_path, cat, tags, keywords, why, owner_id, visibility,
                             image_mime, image_bytes, image_sha256)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [row.name, row.image_path, row.cat, row.tags, row.keywords, row.why, row.owner_id,
            row.visibility || 'private', row.image_mime || null, row.image_bytes || null,
            row.image_sha256 || null]);
      },
      /** 아직 AI가 손대지 않은, 사용자가 올린 짤 */
      async needEnrich(limit = 3) {
        return many(`SELECT * FROM memes
                     WHERE owner_id IS NOT NULL AND enriched_at IS NULL
                     ORDER BY created_at LIMIT $1`, [limit]);
      },
      /** out이 null이면 '해봤지만 실패' 표시만 남깁니다 */
      async markEnriched(id, out) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const before = (await client.query('SELECT * FROM memes WHERE id = $1 FOR UPDATE', [id])).rows[0];
          if (!before) { await client.query('COMMIT'); return false; }
          if (out) {
            const beforeState = { name: before.name, cat: before.cat, tags: before.tags,
              keywords: before.keywords, why: before.why };
            const afterState = { name: out.name, cat: out.cat, tags: out.tags,
              keywords: out.keywords, why: out.why };
            if (JSON.stringify(beforeState) !== JSON.stringify(afterState)) {
              await client.query(`INSERT INTO meme_revisions
                (meme_id, actor_type, before_state, after_state) VALUES ($1,'ai',$2,$3)`,
                [id, JSON.stringify(beforeState), JSON.stringify(afterState)]);
            }
            await client.query(`UPDATE memes SET name=$2, cat=$3, tags=$4, keywords=$5, why=$6,
              enriched_at=now(), updated_at=now() WHERE id=$1`,
              [id, out.name, out.cat, out.tags, out.keywords, out.why]);
          } else {
            await client.query('UPDATE memes SET enriched_at=now() WHERE id=$1', [id]);
          }
          await client.query('COMMIT');
          return true;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
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
          .map(r => ({ meme_id: Number(r.meme_id), board_id: r.board_id == null ? null : Number(r.board_id), at: r.at }));
      },
      /** boardId가 null이면 저장함 없이 저장 */
      async add(userId, boardId, memeId) {
        await pool.query(
          `INSERT INTO saves (user_id, board_id, meme_id) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`,
          [userId, boardId, memeId]);
      },
      /** 그 자리에서만 빼기 — boardId가 null이면 '저장함 없이' 자리 */
      async remove(userId, boardId, memeId) {
        await (boardId === null
          ? pool.query('DELETE FROM saves WHERE user_id = $1 AND meme_id = $2 AND board_id IS NULL',
              [userId, memeId])
          : pool.query('DELETE FROM saves WHERE user_id = $1 AND board_id = $2 AND meme_id = $3',
              [userId, boardId, memeId]));
      },
      /** 어디에 담겼든 전부 */
      async clear(userId, memeId) {
        await pool.query('DELETE FROM saves WHERE user_id = $1 AND meme_id = $2', [userId, memeId]);
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
          ON CONFLICT (user_id, meme_id) DO UPDATE
            SET reason = EXCLUDED.reason, status = 'open', updated_at = now()`,
          [userId, memeId, reason]);
      },
      async remove(userId, memeId) {
        await pool.query('DELETE FROM reports WHERE user_id = $1 AND meme_id = $2', [userId, memeId]);
      },
    },

    audit: {
      async record({ userId = null, action, targetType, targetId = null, metadata = {} }) {
        await pool.query(`INSERT INTO audit_events
          (actor_user_id, action, target_type, target_id, metadata) VALUES ($1,$2,$3,$4,$5)`,
          [userId, action, targetType, targetId == null ? null : String(targetId), JSON.stringify(metadata)]);
      },
    },

    aiRequests: {
      async record({ feature, model, status, inputTokens, outputTokens, latencyMs, errorCode }) {
        await pool.query(`INSERT INTO ai_requests
          (feature, model, status, input_tokens, output_tokens, latency_ms, error_code)
          VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [feature, model, status, inputTokens ?? null, outputTokens ?? null,
            latencyMs ?? null, errorCode ?? null]);
      },
    },
  };
}
