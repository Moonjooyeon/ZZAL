CREATE TABLE IF NOT EXISTS ad_events (
  ad_group text NOT NULL CHECK (ad_group IN ('funny-memes', 'cats-dogs')),
  action text NOT NULL CHECK (action IN ('download', 'share')),
  visit_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ad_group, action, visit_id)
);
