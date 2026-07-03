// shared/keywords.ts — 검색 키워드

export const SEARCH_KEYWORDS = [
  "데크", "목재데크", "합성목", "합성목재",
  "조경시설", "목재시설", "방부목", "수변데크",
  "보행데크", "친수", "옥상녹화", "파고라"
];

export function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return SEARCH_KEYWORDS.filter(kw => lower.includes(kw.toLowerCase()));
}
