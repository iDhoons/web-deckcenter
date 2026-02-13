-- ============================================
-- 입찰 통계 분석 뷰
-- ============================================

-- 1. 월별 입찰 건수/금액 (source별)
CREATE OR REPLACE VIEW bid_monthly_stats AS
SELECT
  date_trunc('month', COALESCE(reg_date, created_at))::date AS month,
  source,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE status = 'active') AS active_count,
  COUNT(*) FILTER (WHERE status = 'closed') AS closed_count,
  AVG(estimated_price) FILTER (WHERE estimated_price > 0) AS avg_price,
  SUM(estimated_price) FILTER (WHERE estimated_price > 0) AS total_price
FROM bid_notices
GROUP BY date_trunc('month', COALESCE(reg_date, created_at))::date, source
ORDER BY month DESC;

GRANT SELECT ON bid_monthly_stats TO anon;

-- 2. 지역별 입찰 분포
CREATE OR REPLACE VIEW bid_regional_stats AS
SELECT
  COALESCE(SPLIT_PART(region, ' ', 1), '미분류') AS province,
  COUNT(*) AS bid_count,
  SUM(estimated_price) FILTER (WHERE estimated_price > 0) AS total_price,
  AVG(estimated_price) FILTER (WHERE estimated_price > 0) AS avg_price
FROM bid_notices
GROUP BY SPLIT_PART(region, ' ', 1)
ORDER BY bid_count DESC;

GRANT SELECT ON bid_regional_stats TO anon;

-- 3. 월별 평균 낙찰률
CREATE OR REPLACE VIEW bid_award_stats AS
SELECT
  date_trunc('month', award_date)::date AS month,
  COUNT(*) AS result_count,
  AVG(award_rate) AS avg_rate,
  MIN(award_rate) AS min_rate,
  MAX(award_rate) AS max_rate,
  AVG(award_price) AS avg_price
FROM bid_results
WHERE award_date IS NOT NULL
GROUP BY date_trunc('month', award_date)::date
ORDER BY month DESC;

GRANT SELECT ON bid_award_stats TO anon;

-- 4. 상위 수주 업체 (최대 20개)
CREATE OR REPLACE VIEW bid_top_contractors AS
SELECT
  company_name,
  COUNT(*) AS win_count,
  SUM(award_price) AS total_award_price,
  AVG(award_rate) AS avg_rate,
  MAX(award_date) AS last_award_date
FROM bid_results
WHERE company_name IS NOT NULL
GROUP BY company_name
ORDER BY win_count DESC, total_award_price DESC
LIMIT 20;

GRANT SELECT ON bid_top_contractors TO anon;

-- 5. 예정가격 구간별 분포
CREATE OR REPLACE VIEW bid_price_distribution AS
SELECT
  CASE
    WHEN estimated_price < 10000000 THEN '1천만 미만'
    WHEN estimated_price < 50000000 THEN '1천~5천만'
    WHEN estimated_price < 100000000 THEN '5천만~1억'
    WHEN estimated_price < 500000000 THEN '1~5억'
    WHEN estimated_price < 1000000000 THEN '5~10억'
    ELSE '10억 이상'
  END AS price_range,
  CASE
    WHEN estimated_price < 10000000 THEN 1
    WHEN estimated_price < 50000000 THEN 2
    WHEN estimated_price < 100000000 THEN 3
    WHEN estimated_price < 500000000 THEN 4
    WHEN estimated_price < 1000000000 THEN 5
    ELSE 6
  END AS sort_order,
  COUNT(*) AS bid_count
FROM bid_notices
WHERE estimated_price > 0
GROUP BY price_range, sort_order
ORDER BY sort_order;

GRANT SELECT ON bid_price_distribution TO anon;
