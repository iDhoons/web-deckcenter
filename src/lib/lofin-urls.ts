/**
 * 지자체(lofin) 입찰 건 → 각 지자체 입찰/계약정보 페이지 URL 매핑
 *
 * laf_cd 구조: 7자리 행정표준코드 (시도 2자리 + 시군구 2자리 + 읍면동 3자리)
 * 예: 2624000 = 부산 수영구, 4111000 = 경기 수원시
 */

/** 광역자치단체 (시도) 입찰 페이지 — 행정표준코드 앞 2자리 */
const PROVINCE_BID_URLS: Record<string, string> = {
  '11': 'https://contract.seoul.go.kr/new1/views/pubBidInfo.do',        // 서울
  '26': 'https://www.busan.go.kr/depart/noticetender',                  // 부산
  '27': 'https://www.daegu.go.kr/index.do?menu_id=00000856',            // 대구
  '28': 'https://gyeyak.incheon.go.kr/',                                // 인천
  '29': 'https://www.gwangju.go.kr/contentsView.do?pageId=www791',      // 광주
  '30': 'https://www.daejeon.go.kr/gyeyak/index.do',                    // 대전
  '31': 'https://www.ulsan.go.kr/contract/bid/announcement/service',    // 울산
  '36': 'https://www.sejong.go.kr/contract.do',                         // 세종
  '41': 'https://www.gg.go.kr/bbs/board.do?bsIdx=488&menuId=1579',     // 경기
  '42': 'https://www.provin.gangwon.kr/gw/portal/sub05_05_02',          // 강원
  '43': 'https://www.chungbuk.go.kr/www/selectGosiPblancList.do?key=422', // 충북
  '44': 'http://gyeyak.chungnam.net/main.do',                           // 충남
  '45': 'https://jeonbuk.go.kr/board/list.jeonbuk?boardId=BBS_0000028&menuCd=DOM_000000103004007000', // 전북
  '46': 'https://www.jeonnam.go.kr/J0203/boardView.do',                 // 전남
  '47': 'https://www.gb.go.kr/Main/page.do?mnu_uid=6789&BD_CODE=gosi_notice&cmd=2', // 경북
  '48': 'https://www.gyeongnam.go.kr/index.gyeong?menuCd=DOM_000000116003002000', // 경남
  '49': 'https://www.jeju.go.kr/open/contract/bid.htm',                 // 제주
  '50': 'https://www.jeju.go.kr/open/contract/bid.htm',                 // 제주 (신코드)
};

/**
 * lofin 입찰 건의 상세 URL을 생성합니다.
 * 항상 URL을 반환합니다 (매핑 없으면 네이버 검색 fallback).
 */
export function getLofinBidUrl(
  lafCd: string | undefined,
  lafHgNm: string | undefined,
  title: string | undefined,
): string {
  if (lafCd) {
    const provinceUrl = PROVINCE_BID_URLS[lafCd.slice(0, 2)];
    if (provinceUrl) return provinceUrl;
  }

  // fallback: 네이버 검색
  const query = [lafHgNm, '입찰공고', title?.slice(0, 30)].filter(Boolean).join(' ');
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query || '지자체 입찰공고')}`;
}
