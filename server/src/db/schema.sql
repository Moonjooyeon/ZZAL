-- schema.sql — 이짤이이짤 테이블 정의 (PostgreSQL)
-- 적용: psql "$DATABASE_URL" -f server/src/db/schema.sql

-- 사용자 ─ 카카오·구글 소셜 로그인으로만 만들어집니다. 비밀번호를 보관하지 않습니다.
CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  provider     TEXT        NOT NULL CHECK (provider IN ('kakao','google')),
  provider_id  TEXT        NOT NULL,          -- 공급자가 준 고유 id
  name         TEXT        NOT NULL,
  email        TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);

-- 짤 카탈로그 ─ 기본 806개 + 사용자가 올린 것
CREATE TABLE IF NOT EXISTS memes (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  image_path  TEXT        NOT NULL,           -- 오브젝트 스토리지 키 또는 URL
  cat         TEXT        NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',   -- 화면에 #태그로 보이는 것
  keywords    TEXT[]      NOT NULL DEFAULT '{}',   -- 숨은 키워드. 절대 화면에 내보내지 않음
  why         TEXT        NOT NULL DEFAULT '',
  owner_id    BIGINT      REFERENCES users(id) ON DELETE CASCADE,  -- NULL이면 기본 카탈로그
  visibility  TEXT        NOT NULL DEFAULT 'public'
              CHECK (visibility IN ('public','private')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 검색: 제목·태그·키워드·설명을 한 덩어리로 묶어 GIN 인덱스
CREATE INDEX IF NOT EXISTS memes_search_idx ON memes
  USING GIN (to_tsvector('simple',
    name || ' ' || array_to_string(tags,' ') || ' ' || array_to_string(keywords,' ') || ' ' || why));
CREATE INDEX IF NOT EXISTS memes_cat_idx   ON memes (cat);
CREATE INDEX IF NOT EXISTS memes_owner_idx ON memes (owner_id);

-- 저장함 ─ 사용자가 만드는 짤 묶음
CREATE TABLE IF NOT EXISTS boards (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  is_private BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS boards_user_idx ON boards (user_id, updated_at DESC);

-- 저장한 짤 ─ 어느 저장함에 담았는지까지.
-- board_id가 NULL이면 저장함에 넣지 않고 저장만 해둔 것입니다.
-- 같은 짤을 여러 저장함에 담을 수 있어 (user, meme) 만으로는 유일하지 않고,
-- NULL은 PK에 넣을 수 없어 표현식 유니크 인덱스로 중복을 막습니다.
CREATE TABLE IF NOT EXISTS saves (
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  board_id   BIGINT      REFERENCES boards(id) ON DELETE CASCADE,
  meme_id    BIGINT      NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS saves_uniq_idx
  ON saves (user_id, meme_id, COALESCE(board_id, 0));
CREATE INDEX IF NOT EXISTS saves_user_idx  ON saves (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saves_board_idx ON saves (board_id, created_at DESC);

-- 신고 ─ 신고한 사람의 피드에서 바로 숨기고, 운영자가 나중에 확인합니다
CREATE TABLE IF NOT EXISTS reports (
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meme_id    BIGINT      NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  reason     TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'open'
             CHECK (status IN ('open','reviewed','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, meme_id)
);
CREATE INDEX IF NOT EXISTS reports_open_idx ON reports (status, created_at DESC);
