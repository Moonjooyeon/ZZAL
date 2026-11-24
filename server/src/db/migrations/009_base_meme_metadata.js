import { BASE_MEME_ROWS } from '../../../../web/js/data/index.js';

export default async function applyBaseMemeMetadata(client) {
  const records = BASE_MEME_ROWS.map(([id, name, image_path, , tags, keywords]) => ({
    id, image_path, name, tags, keywords,
  }));
  await client.query(`
    UPDATE memes m SET name = i.name, tags = i.tags, keywords = i.keywords, updated_at = now()
    FROM jsonb_to_recordset($1::jsonb) AS i(
      id bigint, image_path text, name text, tags text[], keywords text[]
    )
    WHERE m.id = i.id AND m.image_path = i.image_path
      AND m.owner_id IS NULL AND m.visibility = 'public'
      AND (m.name, m.tags, m.keywords) IS DISTINCT FROM (i.name, i.tags, i.keywords)`,
  [JSON.stringify(records)]);
}
