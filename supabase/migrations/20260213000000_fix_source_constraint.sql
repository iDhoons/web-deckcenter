-- ============================================
-- source CHECK 제약 수정: d2b, lofin 추가
-- ============================================

ALTER TABLE bid_notices DROP CONSTRAINT IF EXISTS bid_notices_source_check;
ALTER TABLE bid_notices ADD CONSTRAINT bid_notices_source_check
  CHECK (source IN ('g2b', 'kapt', 'alio', 'd2b', 'lofin'));
