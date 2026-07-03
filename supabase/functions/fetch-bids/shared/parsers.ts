// shared/parsers.ts — 파싱 유틸리티

// 결정적 문자열 해시 (LOFIN contractId 폴백용)
export function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export function safeParseInt(val?: string | number | null): number | null {
  if (val == null || val === '') return null;
  const n = parseInt(String(val).replace(/[^0-9-]/g, ''));
  return isNaN(n) ? null : n;
}

export function toTimestamp(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    let normalized = dateStr.trim();
    // YYYYMMDD → YYYY-MM-DD (K-water, LH 등 data.go.kr API 형식)
    if (/^\d{8}$/.test(normalized)) {
      normalized = `${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}`;
    }
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

// LH XML에서 태그 값 추출 (CDATA 내 특수문자 대응)
export function xmlGetText(itemXml: string, tag: string): string {
  // CDATA 경로: <tag><![CDATA[...anything...]]></tag>
  const cdataRe = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = itemXml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();
  // 일반 경로: <tag>text</tag>
  const plainRe = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const plainMatch = itemXml.match(plainRe);
  return plainMatch ? plainMatch[1].trim() : '';
}
