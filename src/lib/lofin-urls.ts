/**
 * 지자체(lofin) 입찰 건 → 각 지자체 입찰/계약정보 페이지 URL 매핑
 *
 * laf_cd 구조: 5자리 (시도 2자리 + 시군구 3자리)
 * 예: 11000 = 서울시, 23030 = 인천 부평구
 */

/** 광역자치단체 (시도) 입찰 페이지 — laf_cd 앞 2자리 */
const PROVINCE_BID_URLS: Record<string, string> = {
  '11': 'https://contract.seoul.go.kr/new1/views/pubBidInfo.do',
  '21': 'https://www.busan.go.kr/depart/noticetender',
  '22': 'https://www.daegu.go.kr/index.do?menu_id=00000856',
  '23': 'https://gyeyak.incheon.go.kr/',
  '24': 'https://www.gwangju.go.kr/contentsView.do?pageId=www791',
  '25': 'https://www.daejeon.go.kr/gyeyak/index.do',
  '26': 'https://www.ulsan.go.kr/contract/bid/announcement/service',
  '29': 'https://www.sejong.go.kr/contract.do',
  '31': 'https://www.gg.go.kr/bbs/board.do?bsIdx=488&menuId=1579',
  '32': 'https://www.provin.gangwon.kr/gw/portal/sub05_05_02',
  '33': 'https://www.chungbuk.go.kr/www/selectGosiPblancList.do?key=422',
  '34': 'http://gyeyak.chungnam.net/main.do',
  '35': 'https://jeonbuk.go.kr/board/list.jeonbuk?boardId=BBS_0000028&menuCd=DOM_000000103004007000',
  '36': 'https://www.jeonnam.go.kr/J0203/boardView.do',
  '37': 'https://www.gb.go.kr/Main/page.do?mnu_uid=6789&BD_CODE=gosi_notice&cmd=2',
  '38': 'https://www.gyeongnam.go.kr/index.gyeong?menuCd=DOM_000000116003002000',
  '39': 'https://www.jeju.go.kr/open/contract/bid.htm',
};

/** 기초자치단체 (시군구) 입찰 페이지 — laf_cd 5자리. 주요 지자체만, 점진 확장. */
const DISTRICT_BID_URLS: Record<string, string> = {
  // 인천
  '23010': 'https://www.icdonggu.go.kr/main/contract/contractList.do',
  '23030': 'https://www.icbp.go.kr/main/contract/contractList.do',
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
    // 1차: 기초자치단체(시군구) 직접 매핑
    const districtUrl = DISTRICT_BID_URLS[lafCd];
    if (districtUrl) return districtUrl;

    // 2차: 광역자치단체(시도) 매핑
    const provinceUrl = PROVINCE_BID_URLS[lafCd.slice(0, 2)];
    if (provinceUrl) return provinceUrl;
  }

  // 3차: 네이버 검색 fallback
  const query = [lafHgNm, '입찰공고', title?.slice(0, 30)].filter(Boolean).join(' ');
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query || '지자체 입찰공고')}`;
}
