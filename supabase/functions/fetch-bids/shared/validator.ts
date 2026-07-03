// shared/validator.ts — 데이터 검증 관문

import type { NormalizedBid } from '../types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBid(bid: NormalizedBid): ValidationResult {
  const errors: string[] = [];

  if (!bid.source) errors.push('source 누락');
  if (!bid.bid_num) errors.push('bid_num 누락');
  if (!bid.title || bid.title.trim() === '') errors.push('title 누락');
  if (bid.estimated_price !== undefined && bid.estimated_price !== null && bid.estimated_price < 0) {
    errors.push(`가격이 음수: ${bid.estimated_price}`);
  }
  if (bid.reg_date && isNaN(Date.parse(bid.reg_date))) {
    errors.push(`날짜 형식 오류: ${bid.reg_date}`);
  }
  if (bid.matched_keywords.length === 0) {
    errors.push('매칭 키워드 없음');
  }

  return { valid: errors.length === 0, errors };
}

export function filterValidBids(bids: NormalizedBid[]): { valid: NormalizedBid[]; invalidCount: number } {
  let invalidCount = 0;
  const valid = bids.filter(bid => {
    const result = validateBid(bid);
    if (!result.valid) {
      invalidCount++;
      console.warn(`[${bid.source}] 검증 실패 (${bid.bid_num}): ${result.errors.join(', ')}`);
    }
    return result.valid;
  });
  return { valid, invalidCount };
}
