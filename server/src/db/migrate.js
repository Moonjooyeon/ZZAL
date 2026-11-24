// Existing PostgreSQL volumes receive each numbered migration once.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate(pool) {
  const files = (await fs.readdir(migrationsDir)).filter(name => /^\d+_[\w-]+\.(sql|js)$/.test(name)).sort();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(90821401)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(row => row.name));
    for (const name of files) {
      if (applied.has(name)) continue;
      if (name.endsWith('.sql')) {
        await client.query(await fs.readFile(path.join(migrationsDir, name), 'utf8'));
      } else {
        const { default: apply } = await import(new URL(`./migrations/${name}`, import.meta.url));
        await apply(client);
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log(`[db] migration applied: ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
