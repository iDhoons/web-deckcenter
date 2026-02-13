-- ============================================
-- AI 입찰 요약 스키마
-- ============================================

CREATE TABLE IF NOT EXISTS bid_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_notice_id uuid NOT NULL REFERENCES bid_notices(id) ON DELETE CASCADE,
  model_id text NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
  required_materials text[],
  budget_range text,
  qualifications text[],
  project_scale text,
  key_summary text,
  material_types text[],
  estimated_deck_area text,
  raw_response jsonb DEFAULT '{}'::jsonb,
  input_tokens int,
  output_tokens int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_notice_id)
);

CREATE INDEX idx_bid_summaries_notice ON bid_summaries (bid_notice_id);

ALTER TABLE bid_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bid_summaries_public_read" ON bid_summaries
  FOR SELECT USING (true);

-- raw_response 제외 공개 뷰
CREATE VIEW bid_summaries_public AS
SELECT
  id, bid_notice_id, required_materials, budget_range,
  qualifications, project_scale, key_summary, material_types,
  estimated_deck_area, created_at
FROM bid_summaries;

GRANT SELECT ON bid_summaries_public TO anon;
