const storageKey = 'zzal-search-ad-visit';
const groups = new Set(['funny-memes', 'cats-dogs']);
const params = new URLSearchParams(location.search);
const landingGroup = params.get('utm_source') === 'google'
  && params.get('utm_medium') === 'cpc'
  && params.get('utm_campaign') === 'zzal_search_test'
  && groups.has(params.get('utm_content')) ? params.get('utm_content') : null;

function adVisit() {
  let prior;
  try { prior = JSON.parse(sessionStorage.getItem(storageKey)); } catch {}
  if (groups.has(prior?.group) && prior.visit && (!landingGroup || prior.group === landingGroup)) {
    return prior;
  }
  if (!landingGroup || !globalThis.crypto?.randomUUID) return null;
  const current = { group: landingGroup, visit: crypto.randomUUID() };
  try { sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch {}
  return current;
}

const attribution = navigator.globalPrivacyControl ? null : adVisit();

export function recordAdEvent(action) {
  if (!attribution) return;
  fetch('/api/ad-events', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group: attribution.group, visit: attribution.visit, action }),
    keepalive: true,
  }).catch(() => {});
}
