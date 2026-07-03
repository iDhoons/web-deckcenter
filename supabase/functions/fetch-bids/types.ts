// types.ts — 공통 타입 정의

export type BidSource = 'kapt' | 'g2b' | 'd2b' | 'lofin' | 'kwater' | 'lh';

export interface NormalizedBid {
  source: BidSource;
  bid_num: string;
  title: string;
  content?: string | null;
  org_name?: string | null;
  org_code?: string | null;
  region?: string | null;
  estimated_price?: number | null;
  bid_method?: string | null;
  award_method?: string | null;
  bid_type?: string | null;
  reg_date: string | null;
  deadline?: string | null;
  open_date?: string | null;
  file_url?: string | null;
  detail_url?: string | null;
  matched_keywords: string[];
  status: 'active' | 'closed';
  raw_data: unknown;
}

export interface NormalizedResult {
  source: BidSource;
  bid_num: string;
  bid_notice_id?: string;
  company_name?: string;
  company_bizno?: string | null;
  award_price?: number | null;
  award_rate?: number | null;
  award_date: string | null;
  raw_data: unknown;
}

export interface FetchResult {
  bids: NormalizedBid[];
  results: NormalizedResult[];
}
