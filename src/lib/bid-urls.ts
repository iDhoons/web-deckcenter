/**
 * 입찰 건 상세 URL 통합 모듈
 * BidsGlimpse, BidsPreview, bids/index에서 공유
 */

import { getLofinBidUrl } from './lofin-urls';

const INVALID_LOFIN_URL = 'lofin365.go.kr/portal/service/openInf498.do';

export function getDetailUrl(bid: {
  detail_url?: string | null;
  source?: string;
  bid_num?: string;
  title?: string;
  raw_data?: Record<string, any>;
}): string | null {
  // 기존 detail_url 사용 (단, 잘못된 lofin365 URL은 제외)
  if (bid.detail_url && !bid.detail_url.includes(INVALID_LOFIN_URL)) {
    return bid.detail_url;
  }

  switch (bid.source) {
    case 'lofin':
      return getLofinBidUrl(
        bid.raw_data?.laf_cd,
        bid.raw_data?.laf_hg_nm ?? bid.raw_data?.wa_laf_hg_nm,
        bid.title,
      );
    case 'g2b':
      return bid.bid_num
        ? `https://www.g2b.go.kr:8101/ep/invitation/publish/bidInfoDtl.do?bidno=${bid.bid_num}`
        : null;
    case 'kapt':
      return bid.bid_num
        ? `https://www.k-apt.go.kr/bid/bidDetail.do?bidNum=${bid.bid_num}`
        : null;
    case 'd2b':
      return bid.bid_num
        ? `https://www.d2b.go.kr/internet/pblancDetail.do?pblancNo=${bid.bid_num}`
        : null;
    case 'kwater':
      return 'https://ebid.kwater.or.kr/';
    case 'lh':
      return 'https://ebid.lh.or.kr/';
    default:
      return null;
  }
}
