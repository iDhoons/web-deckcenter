-- ============================================
-- source CHECK 제약 수정: kwater, lh 추가
-- ============================================

-- bid_notices: kwater, lh 추가
ALTER TABLE bid_notices DROP CONSTRAINT IF EXISTS bid_notices_source_check;
ALTER TABLE bid_notices ADD CONSTRAINT bid_notices_source_check
  CHECK (source IN ('g2b', 'kapt', 'alio', 'd2b', 'lofin', 'kwater', 'lh'));

-- bid_results: 동일 constraint 추가 (기존 없음)
ALTER TABLE bid_results DROP CONSTRAINT IF EXISTS bid_results_source_check;
ALTER TABLE bid_results ADD CONSTRAINT bid_results_source_check
  CHECK (source IN ('g2b', 'kapt', 'alio', 'd2b', 'lofin', 'kwater', 'lh'));
