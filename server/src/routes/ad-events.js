import { badRequest, forbidden, noContent, readJson } from '../http/respond.js';

const groups = new Set(['funny-memes', 'cats-dogs']);
const actions = new Set(['download', 'share']);
const visitId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function adEventRoutes(router) {
  router.post('/api/ad-events', async (req, res, { db }) => {
    if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') {
      throw forbidden();
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw badRequest();
    const event = await readJson(req, 256);
    if (!event || !groups.has(event.group) || !actions.has(event.action)
        || typeof event.visit !== 'string' || !visitId.test(event.visit)) {
      throw badRequest();
    }
    await db.adEvents.record(event.group, event.action, event.visit);
    noContent(res);
  });
}
