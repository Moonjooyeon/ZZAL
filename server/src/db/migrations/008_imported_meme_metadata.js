import { IMPORTED_MEME_ROWS } from '../../../../web/js/data/index.js';

export default async function applyImportedMemeMetadata(client) {
  const records = IMPORTED_MEME_ROWS.map(([id, name, image_path, , tags, keywords, , source_url]) => ({
    id, image_path, source_url, name, tags, keywords,
  }));
  const { rows: [{ matched }] } = await client.query(`
    WITH incoming AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
        id bigint, image_path text, source_url text, name text, tags text[], keywords text[]
      )
    ), catalog AS (
      SELECT m.id, i.name, i.tags, i.keywords FROM incoming i
      JOIN memes m ON m.id = i.id AND m.image_path = i.image_path
      JOIN meme_sources s ON s.meme_id = m.id AND s.source_url = i.source_url
      WHERE m.owner_id IS NULL AND m.visibility = 'public' AND s.platform IN ('x', 'pinterest')
    ), updated AS (
      UPDATE memes m SET name = c.name, tags = c.tags, keywords = c.keywords, updated_at = now()
      FROM catalog c WHERE m.id = c.id
        AND (m.name, m.tags, m.keywords) IS DISTINCT FROM (c.name, c.tags, c.keywords)
    )
    SELECT count(*)::int AS matched FROM catalog`, [JSON.stringify(records)]);
  if (matched !== records.length) throw new Error(`Imported meme metadata migration matched ${matched} of ${records.length} memes`);
}
