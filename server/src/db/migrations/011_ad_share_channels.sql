ALTER TABLE ad_events RENAME TO ad_event_log;
ALTER TABLE ad_event_log
  DROP CONSTRAINT ad_events_action_check,
  ADD CONSTRAINT ad_event_log_action_check
    CHECK (action IN ('download', 'share', 'share_x', 'share_facebook', 'share_email')),
  ADD COLUMN excluded_at timestamptz;

CREATE VIEW ad_events AS
SELECT ad_group, action, visit_id, created_at
FROM ad_event_log
WHERE excluded_at IS NULL;
