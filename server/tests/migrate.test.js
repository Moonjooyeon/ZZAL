import assert from 'node:assert/strict';
import test from 'node:test';
import { migrate } from '../src/db/migrate.js';

test('migration is applied once and recorded in the same transaction', async () => {
  const applied = new Set();
  const statements = [];
  const client = {
    async query(sql, args = []) {
      statements.push(sql);
      if (sql === 'SELECT name FROM schema_migrations') {
        return { rows: [...applied].map(name => ({ name })) };
      }
      if (sql === 'INSERT INTO schema_migrations (name) VALUES ($1)') applied.add(args[0]);
      return { rows: [] };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };
  await migrate(pool);
  assert.deepEqual([...applied], ['001_operational.sql']);
  const firstSqlRuns = statements.filter(sql => sql.includes('CREATE TABLE auth_sessions')).length;
  assert.equal(firstSqlRuns, 1);
  assert.equal(statements.at(-1), 'COMMIT');

  await migrate(pool);
  assert.equal(statements.filter(sql => sql.includes('CREATE TABLE auth_sessions')).length, 1);
  assert.equal(statements.at(-1), 'COMMIT');
});
