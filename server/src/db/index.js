// db/index.js — 설정에 따라 저장소를 고릅니다.
// 두 어댑터는 같은 인터페이스를 구현하므로 라우트 코드는 어느 쪽인지 몰라도 됩니다.
import { config } from '../config.js';
import { createJsonDb } from './json.js';

let db = null;

export async function getDb() {
  if (db) return db;
  if (config.db.driver === 'postgres') {
    if (!config.db.url) throw new Error('DB_DRIVER=postgres 인데 DATABASE_URL이 없습니다.');
    const { createPostgresDb } = await import('./postgres.js');
    db = await createPostgresDb(config.db.url);
  } else {
    db = createJsonDb(config.db.file);
  }
  return db;
}
