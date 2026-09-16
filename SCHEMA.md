# 데이터베이스 설계

지금은 프론트엔드만 있고 브라우저에만 저장합니다. 백엔드가 붙으면
`index.html`의 `store` 객체 본문만 API 호출로 바꾸면 되고, 화면 코드는
그대로 둡니다. 아래는 그때 만들 테이블입니다.

## users

소셜 로그인만 받으므로 비밀번호 컬럼이 없습니다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `provider` | text | `kakao` \| `google` |
| `provider_uid` | text | 공급자가 준 고유 ID |
| `email` | text | 공급자가 안 줄 수도 있어 nullable |
| `name` | text | 표시 이름 |
| `avatar_url` | text | |
| `created_at` / `last_seen_at` | timestamptz | |

`unique (provider, provider_uid)` — 같은 계정 중복 가입 방지.

## memes

지금 `memes-extra*.js`에 하드코딩된 806개가 들어갈 자리입니다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigint PK | 현재 JS의 id를 그대로 씁니다 |
| `name` | text | 제목 |
| `image_path` | text | 오브젝트 스토리지 키 |
| `category` | text | 리액션 / 동물 / 그림 / 대화·SNS / 글·댓글 / 방송·자막 |
| `tags` | text[] | 카드에 `#`로 보이는 2개 |
| `keywords` | text[] | 검색용 숨은 키워드 (평균 23개) |
| `description` | text | 언제 쓰는 짤인지 |
| `uploader_id` | uuid FK → users | 운영진이 넣은 건 null |
| `visibility` | text | `public` \| `private` \| `hidden` |
| `created_at` | timestamptz | |

검색은 `keywords`와 `name`에 GIN 인덱스를 걸면 지금 프론트에서 하는
점수 계산을 그대로 SQL로 옮길 수 있습니다.

## saves

| 컬럼 | 타입 |
|---|---|
| `user_id` | uuid FK → users |
| `meme_id` | bigint FK → memes |
| `created_at` | timestamptz |

PK는 `(user_id, meme_id)`. 지금의 `zzal.u.<uid>.saved`에 해당합니다.

## uploads

사용자가 올린 짤. 지금은 data URL을 통째로 브라우저에 넣고 있어서
용량 제한에 걸리는데, 실제로는 파일을 스토리지에 올리고 경로만 저장합니다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | uuid FK → users | |
| `image_path` | text | 스토리지 키 |
| `name` | text | 사용자가 적은 한 줄 |
| `rights_confirmed` | boolean | 업로드 폼의 권리 확인 체크 |
| `status` | text | `pending` \| `approved` \| `rejected` |
| `created_at` | timestamptz | |

## reports

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | bigint PK | |
| `user_id` | uuid FK → users | |
| `meme_id` | bigint FK → memes | |
| `reason` | text | 부적절 / 저작권 / 스팸 / 제목불일치 / 기타 |
| `created_at` | timestamptz | |
| `resolved_at` | timestamptz | 운영진 처리 시각 |

`unique (user_id, meme_id)` — 같은 사람이 같은 짤을 여러 번 신고하지 않게.
지금은 신고하면 그 사람 피드에서만 숨는데, 서버가 생기면 누적 신고 수로
`memes.visibility`를 `hidden`으로 내리는 처리를 붙일 수 있습니다.

## 남은 일

- 카카오·구글 OAuth 앱 등록 후 리다이렉트 URI에 회사 도메인 추가
- 이미지 132MB를 레포에서 오브젝트 스토리지로 이전
- `store`의 각 메서드를 API 호출로 교체
- 세션은 httpOnly 쿠키 권장 (지금 데모는 localStorage)
