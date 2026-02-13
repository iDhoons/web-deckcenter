-- ============================================
-- 데크 입찰정보 시스템 스키마
-- ============================================

-- 1. 입찰 공고 테이블 (나라장터 + K-APT)
CREATE TABLE bid_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('g2b', 'kapt', 'alio')),
  bid_num text NOT NULL,
  title text NOT NULL,
  content text,
  org_name text,
  org_code text,
  region text,
  estimated_price bigint,
  bid_method text,
  award_method text,
  bid_type text,
  reg_date timestamptz,
  deadline timestamptz,
  open_date timestamptz,
  file_url text,
  detail_url text,
  matched_keywords text[] DEFAULT '{}',
  status text DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, bid_num)
);

-- 2. 낙찰 결과 테이블
CREATE TABLE bid_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_notice_id uuid REFERENCES bid_notices(id) ON DELETE SET NULL,
  source text NOT NULL,
  bid_num text NOT NULL,
  company_name text NOT NULL,
  company_bizno text,
  company_ceo text,
  award_price bigint,
  award_rate numeric(5,2),
  award_date timestamptz,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, bid_num)
);

-- 3. 건설업체 DB
CREATE TABLE contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  bizno text UNIQUE,
  ceo_name text,
  phone text,
  fax text,
  address text,
  biz_types text[],
  total_bids int DEFAULT 0,
  total_wins int DEFAULT 0,
  last_bid_date timestamptz,
  raw_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. 알림 구독자 테이블
CREATE TABLE subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  email text UNIQUE,
  keywords text[] DEFAULT ARRAY['데크', '목재데크', '합성목'],
  regions text[] DEFAULT '{}',
  channel text DEFAULT 'kakao' CHECK (channel IN ('kakao', 'email', 'both')),
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_bid_notices_reg_date ON bid_notices (reg_date DESC);
CREATE INDEX idx_bid_notices_deadline ON bid_notices (deadline DESC);
CREATE INDEX idx_bid_notices_status ON bid_notices (status);
CREATE INDEX idx_bid_notices_source ON bid_notices (source);
CREATE INDEX idx_bid_notices_keywords ON bid_notices USING GIN (matched_keywords);
CREATE INDEX idx_bid_results_award_date ON bid_results (award_date DESC);
CREATE INDEX idx_bid_results_company ON bid_results (company_name);
CREATE INDEX idx_contractors_bizno ON contractors (bizno);
CREATE INDEX idx_contractors_biz_types ON contractors USING GIN (biz_types);
CREATE INDEX idx_subscribers_active ON subscribers (is_active) WHERE is_active = true;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_bid_notices_updated_at
  BEFORE UPDATE ON bid_notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_contractors_updated_at
  BEFORE UPDATE ON contractors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_subscribers_updated_at
  BEFORE UPDATE ON subscribers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE bid_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_notices_public_read" ON bid_notices FOR SELECT USING (true);
CREATE POLICY "bid_results_public_read" ON bid_results FOR SELECT USING (true);
CREATE POLICY "contractors_public_read" ON contractors FOR SELECT USING (true);
CREATE POLICY "subscribers_insert" ON subscribers FOR INSERT WITH CHECK (true);
