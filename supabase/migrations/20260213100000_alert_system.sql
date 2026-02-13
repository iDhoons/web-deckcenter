-- ============================================
-- 입찰 알림 시스템 스키마
-- ============================================

-- 1. subscribers 테이블 확장
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS unsubscribe_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_unsubscribe_token
  ON subscribers (unsubscribe_token);

-- 2. 알림 발송 로그 (중복 발송 방지)
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  bid_notice_id uuid NOT NULL REFERENCES bid_notices(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, bid_notice_id)
);

CREATE INDEX idx_notification_log_sent ON notification_log (sent_at DESC);

-- 3. RLS (service_role만 접근)
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- notification_log: service_role only (의도적 정책 미생성)
-- Edge Functions에서 service_role 키로만 접근하므로 별도 정책 불필요
COMMENT ON TABLE notification_log IS 'service_role only - no RLS policies needed';

-- subscribers: anon SELECT 불필요 (unsubscribe는 service_role로 처리)
