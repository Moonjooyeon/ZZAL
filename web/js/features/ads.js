// features/ads.js — 피드 사이에 끼는 광고 자리. 아직 준비 중인 시안입니다.

const ADS = [
  { tone: '', brand: '광고주 자리', headline: '짤 사이에서 자연스럽게 발견되는 브랜드', cta: '광고 문의 →', note: '네이티브 이미지 광고 · 준비 중' },
  { tone: 'cool', brand: '스폰서 콘텐츠', headline: '좋아하는 것들 사이에 브랜드를 놓아보세요', cta: '자세히 보기 →', note: '피드형 광고 · 준비 중' },
  { tone: 'ink', brand: '프로모션', headline: '스크롤을 멈추게 하는 한 장', cta: '사이트 방문 →', note: '브랜드 캠페인 · 준비 중' },
];

export function adCard(i) {
  const a = ADS[i % ADS.length];
  return `<aside class="pin ad-pin" aria-label="광고 자리"><div class="ad-card"><div class="ad-visual ${a.tone}"><span class="ad-label">광고</span><div class="ad-copy"><small>${a.brand}</small><strong>${a.headline}</strong><span>${a.cta}</span></div></div></div><div class="ad-meta"><strong>${a.brand}</strong><p>${a.note}</p></div></aside>`;
}

/** 여섯 번째 카드 뒤부터 12개마다 한 자리 */
export const adSlot = i => i >= 5 && (i - 5) % 12 === 0;
export const adIndex = i => Math.floor((i - 5) / 12);
