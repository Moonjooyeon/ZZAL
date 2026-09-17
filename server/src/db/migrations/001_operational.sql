-- Additive migration for existing ZZAL databases. Never rewrite this after deployment.

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_sessions_user_expires_idx ON auth_sessions (user_id, expires_at);

CREATE TABLE meme_sources (
  meme_id BIGINT PRIMARY KEY REFERENCES memes(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_title TEXT,
  creator_name TEXT,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meme_sources_platform_idx ON meme_sources (platform);

CREATE TABLE meme_revisions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  meme_id BIGINT NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ai', 'user', 'admin')),
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX meme_revisions_meme_created_idx ON meme_revisions (meme_id, created_at DESC);

CREATE TABLE ai_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature TEXT NOT NULL CHECK (feature IN ('search_assist', 'meme_enrichment')),
  provider TEXT NOT NULL DEFAULT 'cafe24',
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'refusal')),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_feature_created_idx ON ai_requests (feature, created_at DESC);

CREATE TABLE audit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_created_idx ON audit_events (actor_user_id, created_at DESC);
CREATE INDEX audit_events_action_created_idx ON audit_events (action, created_at DESC);

ALTER TABLE memes ADD COLUMN image_mime TEXT;
ALTER TABLE memes ADD COLUMN image_bytes BIGINT;
ALTER TABLE memes ADD COLUMN image_sha256 TEXT;
ALTER TABLE memes ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX memes_image_sha256_idx ON memes (image_sha256) WHERE image_sha256 IS NOT NULL;

ALTER TABLE reports ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE reports ADD COLUMN reviewed_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN resolution_note TEXT;

CREATE UNIQUE INDEX boards_id_user_idx ON boards (id, user_id);
ALTER TABLE saves ADD CONSTRAINT saves_board_owner_fk
  FOREIGN KEY (board_id, user_id) REFERENCES boards (id, user_id) ON DELETE CASCADE;

-- Imported filenames retain Pinterest pin IDs; backfill traceable source URLs.
INSERT INTO meme_sources (meme_id, platform, source_url)
SELECT id, 'pinterest',
       'https://www.pinterest.com/pin/' || substring(image_path FROM 'pin-([0-9]+)') || '/'
FROM memes
WHERE owner_id IS NULL AND image_path ~ 'pin-[0-9]+'
ON CONFLICT (meme_id) DO NOTHING;
