-- Keep existing Kakao accounts intact while allowing new Apple accounts.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_provider_check;
ALTER TABLE users ADD CONSTRAINT users_provider_check
  CHECK (provider IN ('kakao', 'google', 'apple'));
