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
        ├── ai/             검색 2차 검증 · 올린 짤 분류 · 주기 보강
        └── routes/         auth · memes · boards · uploads · reports · search
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

## Docker로 운영 배포

PostgreSQL까지 함께 띄우려면 Docker가 설치된 서버에서 실행합니다.

```sh
cp .env.docker.example .env
# .env에서 POSTGRES_PASSWORD, SESSION_SECRET, PUBLIC_ORIGIN과 OAuth/AI 키를 입력
docker compose up -d --build
docker compose logs -f app
```

첫 실행 때 PostgreSQL이 `server/src/db/schema.sql`을 적용하고, 비어 있는 경우
프론트 카탈로그를 자동으로 심습니다. 데이터는 `postgres_data` 볼륨에 남으므로
컨테이너를 다시 만들어도 유지됩니다. 도메인의 HTTPS 프록시를 8080 포트에 연결하고,
`PUBLIC_ORIGIN`은 실제 HTTPS 주소로 지정하세요.

## 담긴 기능

- 상황·대사·유행어로 검색 (조사와 형용사 어미를 떼고 찾습니다)
- 카테고리 6종 필터 · 짤 상세 · 문구 복사 · 이미지 내려받기
- 카카오·구글 로그인, 계정별로 나뉘는 저장 공간
- 내 짤 저장 / 직접 올리기 / 삭제 / 신고 후 숨김
- 링크·X·페이스북·이메일·카카오톡 공유 (`?z=<id>` 딥링크)
- 주제별 저장함, 저장함 없이 저장
- PC와 모바일 반응형 (320px까지)

## AI는 어디에 쓰나

검색은 **먼저 내 짤 안에서 규칙으로** 찾습니다. 거기서 못 찾았을 때만
AI가 2차로 검색어를 우리 데이터에 있는 말로 옮겨줍니다. 짤을 지어내지
않습니다. 올린 짤은 주기 작업이 이미지를 보고 분류하고 숨은 키워드를
붙입니다. 둘 다 백엔드에서만 돌고, 키가 없으면 규칙만으로 동작합니다.
자세한 건 [server/README.md](server/README.md).
