# 이짤이이짤 API 서버

의존성 없이 Node 18+ 기본 모듈만으로 돕니다. `npm install` 없이 바로 뜹니다.

```sh
cp .env.example .env
npm start          # http://localhost:8080
```

## 저장소 바꾸기

| `DB_DRIVER` | 쓰는 곳 | 필요한 것 |
|---|---|---|
| `json` (기본) | 개발·시연 | 없음. `DB_FILE` 경로에 JSON 한 장 |
| `postgres` | 실서비스 | `npm i pg`, `DATABASE_URL`, `schema.sql` 적용 |

두 어댑터는 같은 인터페이스(`users` / `memes` / `saves` / `reports`)를
구현하므로 라우트 코드는 어느 쪽인지 몰라도 됩니다.

```sh
psql "$DATABASE_URL" -f src/db/schema.sql
```

## 로그인

`KAKAO_CLIENT_ID` / `GOOGLE_CLIENT_ID` 가 비어 있으면 `DEMO_AUTH=1` 로
임시 계정에 바로 로그인시킵니다. 프론트를 끝까지 눌러볼 수 있게 하기 위한 것이고,
**배포에서는 `DEMO_AUTH=0` 으로 꺼야 합니다.**

앱 키를 받으면 각 공급자 콘솔에 아래 주소를 리다이렉트 URI로 등록하세요.

```
{PUBLIC_ORIGIN}/api/auth/kakao/callback
{PUBLIC_ORIGIN}/api/auth/google/callback
```

세션은 HMAC으로 서명한 httpOnly 쿠키입니다(`SameSite=Lax`, 30일).
`SESSION_SECRET` 은 배포 전에 반드시 바꾸세요 — `openssl rand -hex 32`.

## AI (곁들임)

`CAFE24_LLM_ROUTER_API_KEY` 가 있을 때만 켜집니다. 없으면 검색과 분류는
규칙만으로 돌아가고 서버는 `npm install` 없이도 그대로 뜹니다.
SDK는 키가 있을 때만 불러옵니다(지연 import).

```sh
npm install                 # AI를 쓸 때만 필요
CAFE24_LLM_ROUTER_API_KEY=... npm start
```

Cafe24 LLM Router는 OpenAI 호환 API입니다. 기본 주소는
`https://llm-router.cafe24.com/api/v1`이며, `AI_MODEL=cafe24/auto`로
요청에 맞는 모델을 자동 선택합니다. 특정 모델을 쓰려면 Router의 모델 ID를
`AI_MODEL`에 지정하세요.

키는 서버에만 둡니다. 브라우저로 내려보내지 않습니다.

**1. 검색 2차 검증** — 1차는 프론트가 우리 짤 안에서 규칙으로 찾습니다.
거기서 0건일 때만 `POST /api/search/assist` 로 넘어옵니다. AI는 짤을
고르지 않고 **검색어만 우리 데이터에 있는 말로 옮겨줍니다**. 지어낸 단어가
섞이면 검색이 다시 0건이 되므로, 카탈로그에 실제로 있는 말만 통과시킵니다.

**2. 올린 짤 자동 분류 · 숨은 키워드** — 업로드는 규칙 분류로 바로 응답하고,
`ai/enrich.js` 의 주기 작업이 잠시 뒤 이미지를 보고 카테고리·제목·태그·
숨은 키워드 12~20개·설명을 채웁니다. 업로드를 기다리게 하지 않으려고
나눠 두었습니다. `memes.enriched_at` 이 NULL인 것만 집어가고, 실패해도
표시를 남겨 같은 것을 무한히 다시 집지 않습니다.

## API

인증이 필요한 것은 ★ 표시. 없으면 401과 함께 사람이 읽을 메시지를 돌려줍니다.

| 메서드 | 경로 | 하는 일 |
|---|---|---|
| GET | `/api/health` | 상태 확인 |
| GET | `/api/auth/me` | 내 정보 (없으면 `{user:null}`) |
| GET | `/api/auth/:provider` | 카카오·구글 로그인 화면으로 |
| GET | `/api/auth/:provider/callback` | 공급자 복귀 지점 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/memes?cat=&q=&limit=&offset=` | 짤 목록 |
| GET | `/api/memes/:id` | 짤 하나 |
| GET ★ | `/api/me/saves` | 저장한 짤 id 목록 |
| PUT / DELETE ★ | `/api/me/saves/:memeId` | 저장 / 취소 |
| GET ★ | `/api/me/uploads` | 내가 올린 짤 |
| POST ★ | `/api/me/uploads` | 올리기 `{name, image}` |
| DELETE ★ | `/api/me/uploads/:id` | 내 짤 삭제 |
| GET ★ | `/api/me/reports` | 신고 목록 + 사유 목록 |
| PUT ★ | `/api/me/reports/:memeId` | 신고 `{reason}` |
| DELETE ★ | `/api/me/reports/:memeId` | 숨김 해제 |
| POST | `/api/search/assist` | 검색 2차 검증 `{q}` → `{terms, cats, note}` |

`keywords`(숨은 키워드)는 검색에만 쓰고 응답에 담지 않습니다.

## 남은 일

- 업로드 이미지를 data URL 대신 오브젝트 스토리지(S3/R2)에 올리고 키만 저장
- `assets/` 132MB도 같은 스토리지로 옮기기
- 검색 점수를 프론트(`web/js/features/search.js`)와 맞추기
  — 지금 서버 쪽은 단순 포함 검색입니다
- AI 호출에 사용자별 한도 걸기 (지금은 0건 검색마다 한 번씩 나갑니다)
- 누적 신고 수로 `memes.visibility` 를 내리는 운영 처리
- 요청 수 제한(rate limit)과 접근 로그
