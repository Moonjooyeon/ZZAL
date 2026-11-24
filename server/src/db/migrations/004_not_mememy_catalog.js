import { ROWS } from '../../../../web/js/data/memes-not-mememy.js';

export default async function importCatalog(client) {
  const records = ROWS.map(([id, name, image_path, cat, tags, keywords, why, source_url]) => ({
    id, name, image_path, cat, tags, keywords, why, source_url,
  }));
  await client.query(`
    WITH imported AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
        id bigint, name text, image_path text, cat text, tags text[], keywords text[],
        why text, source_url text
      )
    ), added AS (
      INSERT INTO memes (id, name, image_path, cat, tags, keywords, why, owner_id, visibility)
      SELECT id, name, image_path, cat, tags, keywords, why, NULL, 'public' FROM imported
      RETURNING id
    )
    INSERT INTO meme_sources (meme_id, platform, source_url)
    SELECT added.id, 'x', imported.source_url FROM added JOIN imported USING (id)`,
  [JSON.stringify(records)]);
}
