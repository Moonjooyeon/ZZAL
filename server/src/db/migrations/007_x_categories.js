import { ROWS } from '../../../../web/js/data/memes-not-mememy.js';

export default async function applyXCategories(client) {
  const records = ROWS.map(([id, , image_path, cat, , , , source_url]) => ({
    id, image_path, cat, source_url,
  }));
  const { rows: [{ matched }] } = await client.query(`
    WITH categories AS (
      SELECT * FROM jsonb_to_recordset($1::jsonb) AS item(
        id bigint, image_path text, cat text, source_url text
      )
    ), pins AS (
      SELECT m.id, categories.cat FROM categories
      JOIN memes m ON m.id = categories.id AND m.image_path = categories.image_path
      JOIN meme_sources s ON s.meme_id = m.id AND s.source_url = categories.source_url
      WHERE m.owner_id IS NULL AND s.platform = 'x'
    ), updated AS (
      UPDATE memes m SET cat = pins.cat, updated_at = now()
      FROM pins WHERE m.id = pins.id AND m.cat IS DISTINCT FROM pins.cat
    )
    SELECT count(*)::int AS matched FROM pins`, [JSON.stringify(records)]);
  if (matched !== records.length) throw new Error(`X catalog category migration matched ${matched} of ${records.length} memes`);
}
