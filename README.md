# 이짤이이짤

상황이나 기억나는 대사로 짤을 찾고, 자주 쓰는 짤을 저장하는 웹 서비스입니다.
짤 806개가 들어 있고, 카카오·구글 소셜 로그인을 붙였습니다.

## 폴더 구조

```
.
├── index.html          마크업만. 스타일과 스크립트는 링크로 붙입니다
├── assets/             짤 이미지
│
├── web/                ── 프론트엔드 ──
│   ├── styles/         기능별 CSS 12장
│   └── js/
│       ├── app.js          엔트리 — 모듈을 엮고 부팅
│       ├── core/           화면에 안 묶인 것들
│       │   ├── dom.js         $, esc, toast
│       │   ├── state.js       화면이 같이 보는 상태
│       │   ├── config.js      백엔드를 붙일지 말지
│       │   ├── api.js         데이터 계층 ★ 저장 위치를 정하는 곳
│       │   └── catalog.js     짤 목록 조회
│       ├── data/           짤 원본 806개
│       └── features/       기능 하나에 파일 하나
│           ├── auth.js        로그인 / 로그아웃
│           ├── search.js      한국어 검색 (조사·어미·유행어)
│           ├── feed.js        피드 · 필터 · 화면 전환
│           ├── detail.js      짤 상세 · 딥링크
│           ├── saves.js       내 짤에 저장
│           ├── share.js       SNS 공유
│           ├── moderation.js  삭제 · 신고 · 숨김 해제
│           ├── upload.js      짤 올리기
│           └── ads.js         광고 자리
│
└── server/             ── 백엔드 ──
    └── src/
        ├── index.js        서버 부팅
        ├── config.js       환경변수
        ├── http/           라우터 · 응답 · 정적 파일
        ├── db/             저장소 (json / postgres) + schema.sql
        ├── auth/           카카오·구글 OAuth + 세션 쿠키
        └── routes/         auth · memes · saves · uploads · reports
```

## 띄우는 법

**프론트만** (지금 배포 방식 — Render Static Site, publish directory `.`)

```sh
python3 -m http.server 8000     # 또는 아무 정적 서버
```

데이터는 브라우저에만 저장됩니다. 빌드 과정이 없습니다.

**백엔드까지**

```sh
cd server
cp .env.example .env
npm start                        # 의존성 없이 그대로 뜹니다 (Node 18+)
```

`http://localhost:8080` 에서 API와 프론트를 같이 서빙합니다.
프론트가 API를 쓰게 하려면 `index.html`의 모듈 스크립트 **앞에** 한 줄 넣으세요:

```html
<script>window.ZZAL_API_BASE = ''</script>   <!-- 다른 도메인이면 그 주소 -->
```

자세한 건 [server/README.md](server/README.md).

## 담긴 기능

- 상황·대사·유행어로 검색 (조사와 형용사 어미를 떼고 찾습니다)
- 카테고리 6종 필터 · 짤 상세 · 문구 복사 · 이미지 내려받기
- 카카오·구글 로그인, 계정별로 나뉘는 저장 공간
- 내 짤 저장 / 직접 올리기 / 삭제 / 신고 후 숨김
- 링크·X·페이스북·이메일·카카오톡 공유 (`?z=<id>` 딥링크)
- PC와 모바일 반응형 (320px까지)
