// core/config.js — 프론트 설정.
//
// 기본은 브라우저 저장(정적 배포 그대로). 백엔드를 붙이려면 index.html 의
// 모듈 스크립트 앞에 한 줄만 넣으면 됩니다:
//
//   <script>window.ZZAL_API_BASE = 'https://api.내회사도메인.com'</script>
//
// 같은 서버에서 프론트를 같이 서빙하면 빈 문자열('')로 두고 USE_API만 켭니다.
const configured = typeof window !== 'undefined' ? window.ZZAL_API_BASE : undefined;

export const API_BASE = configured === undefined ? null : String(configured);
export const USE_API = API_BASE !== null;
