CREATE TABLE IF NOT EXISTS user_blocks (
  user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  meme_id         BIGINT NOT NULL REFERENCES memes(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, meme_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_user_idx ON user_blocks (user_id, created_at DESC);
