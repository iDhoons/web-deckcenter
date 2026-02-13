-- ============================================
-- RLS 정책 보안 강화
-- ============================================

-- C-002: subscribers INSERT 정책 강화 (phone 또는 email 필수)
DROP POLICY IF EXISTS "subscribers_insert" ON subscribers;
CREATE POLICY "subscribers_insert" ON subscribers
  FOR INSERT WITH CHECK (
    phone IS NOT NULL OR email IS NOT NULL
  );

-- C-003: contractors 민감정보 보호 - 공개 뷰 생성
CREATE VIEW contractors_public AS
  SELECT id, company_name, biz_types, total_bids, total_wins
  FROM contractors;

GRANT SELECT ON contractors_public TO anon;

-- contractors 테이블 자체는 인증된 사용자만
DROP POLICY IF EXISTS "contractors_public_read" ON contractors;
CREATE POLICY "contractors_authenticated_read" ON contractors
  FOR SELECT TO authenticated USING (true);

-- M-001: bid_notices/bid_results에서 raw_data 제외한 공개 뷰
CREATE VIEW bid_notices_public AS
  SELECT id, source, bid_num, title, content, org_name, region,
         estimated_price, bid_method, award_method, bid_type,
         reg_date, deadline, open_date, detail_url, file_url,
         matched_keywords, status, created_at
  FROM bid_notices;

GRANT SELECT ON bid_notices_public TO anon;

CREATE VIEW bid_results_public AS
  SELECT br.id, br.bid_notice_id, br.source, br.bid_num,
         br.company_name, br.award_price, br.award_rate,
         br.award_date, br.created_at
  FROM bid_results br;

GRANT SELECT ON bid_results_public TO anon;
