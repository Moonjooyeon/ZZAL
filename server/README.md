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

`keywords`(숨은 키워드)는 검색에만 쓰고 응답에 담지 않습니다.

## 남은 일

- 업로드 이미지를 data URL 대신 오브젝트 스토리지(S3/R2)에 올리고 키만 저장
- `assets/` 132MB도 같은 스토리지로 옮기기
- 검색 점수를 프론트(`web/js/features/search.js`)와 맞추기
  — 지금 서버 쪽은 단순 포함 검색입니다
- 누적 신고 수로 `memes.visibility` 를 내리는 운영 처리
- 요청 수 제한(rate limit)과 접근 로그
