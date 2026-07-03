# 데크센터 웹사이트 완성도 개선 - 실행 체크리스트

## 📊 진행 상황
- ✅ 브랜치 생성: `claude`
- ✅ 모바일 네비게이션 구현 완료 (Header.astro)
- ⏳ Contact 페이지 작업 시작 예정

---

## 🎯 PHASE 1: CRITICAL (즉시 구현 - 오늘 완료 목표)

### Task 1: 모바일 네비게이션 ✅ 완료
- [x] Header.astro에 햄버거 메뉴 버튼 추가
- [x] 모바일 드로어 메뉴 구현
- [x] Overlay 클릭/ESC키로 닫기
- [x] View Transitions 호환 스크립트
- [x] 터치 타겟 44x44px 적용
- [x] ARIA labels 추가 (aria-label, aria-expanded)
- [ ] Footer.astro에 "문의" 링크 추가 (다음 작업 후)

**완료 기준:**
- 900px 이하에서 햄버거 메뉴 표시
- 메뉴 열림/닫힘 애니메이션 부드럽게 작동
- 링크 클릭 시 메뉴 자동 닫힘

---

### Task 2: Contact/문의 페이지 생성 🔄 다음 작업
**파일:** `/src/pages/contact.astro` (신규)

**체크리스트:**
- [ ] BaseLayout 사용하여 페이지 생성
- [ ] 페이지 구조:
  - [ ] Hero 섹션 (제목: "문의하기", 부제: "궁금하신 점을 남겨주세요")
  - [ ] 2컬럼 레이아웃:
    - [ ] 좌측: 연락처 정보 카드
      - [ ] 전화번호: 010-XXXX-XXXX
      - [ ] 이메일: contact@deckctr.com
      - [ ] 주소: 서울시 XX구 XX동 (가상)
      - [ ] 영업시간: 평일 9:00-18:00
    - [ ] 우측: 문의 폼
      - [ ] 이름 (required)
      - [ ] 회사명 (optional)
      - [ ] 전화번호 (required)
      - [ ] 이메일 (required)
      - [ ] 문의 유형 (select: 일반 문의/견적 요청/기술 지원/A/S)
      - [ ] 문의 내용 (textarea, required)
      - [ ] 개인정보 처리방침 동의 (checkbox)
      - [ ] 제출 버튼
- [ ] 폼 스타일링 (일관된 디자인)
- [ ] 모바일 반응형 (1컬럼으로 변경)
- [ ] SEO 메타 태그 추가
- [ ] Header에 "문의" 링크 추가 (이미 완료)
- [ ] Footer에 "문의하기" 링크 추가
- [ ] 제출 버튼은 calc.deckctr.com으로 연결 (실제 폼 제출은 나중에)

**완료 기준:**
- `/contact` 접속 시 페이지 정상 표시
- 모든 필드 validation 작동
- 모바일에서 레이아웃 깨지지 않음

---

### Task 3: 신뢰 신호 섹션 추가
**파일:** `/src/pages/index.astro` (수정), `/src/components/Testimonial.astro` (신규)

**Step 1: Testimonial 컴포넌트 생성**
- [ ] `/src/components/Testimonial.astro` 파일 생성
- [ ] Props 인터페이스:
  - [ ] name: string
  - [ ] company: string
  - [ ] content: string
  - [ ] rating?: number (1-5)
  - [ ] project?: string
- [ ] 카드 스타일: 배경, 따옴표 아이콘, 별점 표시

**Step 2: 홈페이지에 신뢰 신호 추가**
- [ ] index.astro의 "시공사례" 섹션 앞에 새 섹션 추가
- [ ] 섹션 제목: "고객 후기"
- [ ] 3-4개 후기 카드 그리드 배치
- [ ] 후기 샘플 데이터:
  1. "판교 카페 테라스 프로젝트 - 합성목 시공"
  2. "한남동 주택 알루미늄 데크 공사"
  3. "공공시설 목재 데크 납품"
  4. "다세대 주택 베란다 시공"

**Step 3: 통계 배지 추가**
- [ ] 섹션 하단에 통계 그리드 (4개):
  - [ ] 시공 건수: "500+ 프로젝트"
  - [ ] 고객 만족도: "98% 만족"
  - [ ] 경력: "15년 경력"
  - [ ] 보증: "5년 품질 보증"

**Step 4: 인증 배지 (선택적)**
- [ ] 하단에 회색 배경 섹션
- [ ] 인증 로고 (KS, ISO, 친환경 인증) 이미지 배치
- [ ] 이미지 없으면 텍스트로 대체

**완료 기준:**
- 홈페이지에 신뢰 신호 섹션 표시
- 카드 hover 효과 작동
- 모바일 반응형 (2열 → 1열)

---

### Task 4: Footer에 Contact 링크 추가
**파일:** `/src/components/Footer.astro` (수정)

- [ ] "회사" 섹션에 "문의하기" 링크 추가
  ```astro
  <li><a href="/contact">문의하기</a></li>
  ```
- [ ] 순서: 회사소개 → 문의하기 → 견적내기

**완료 기준:**
- Footer에서 "/contact" 링크 클릭 시 정상 이동

---

## 🟡 PHASE 2: HIGH PRIORITY (1주 내 구현)

### Task 5: FAQ 페이지
**파일:** `/src/pages/faq.astro` (신규)

**체크리스트:**
- [ ] BaseLayout 사용
- [ ] 아코디언 UI 컴포넌트 구현
- [ ] 카테고리별 FAQ 구성:
  - [ ] **주문/배송** (5개 질문)
    - 최소 주문량이 있나요?
    - 어느 지역까지 배송 가능한가요?
    - 배송 기간은 얼마나 걸리나요?
    - 배송비는 얼마인가요?
    - 대량 주문 할인이 있나요?
  - [ ] **제품/기술** (5개 질문)
    - 목재와 합성목의 차이는?
    - 데크 두께는 어떻게 선택하나요?
    - 색상 샘플을 받을 수 있나요?
    - 내구성은 얼마나 되나요?
    - 방염 성능이 있나요?
  - [ ] **시공** (4개 질문)
    - 시공 서비스도 제공하나요?
    - DIY 시공이 가능한가요?
    - 시공 매뉴얼이 있나요?
    - 필요한 공구는 무엇인가요?
  - [ ] **보증/A/S** (3개 질문)
    - 보증 기간은?
    - 교환/환불 정책은?
    - A/S 신청은 어떻게 하나요?
- [ ] 각 카테고리 탭 또는 아코디언으로 구현
- [ ] 검색 기능 (선택적, 나중에 추가)
- [ ] 하단 CTA: "답변을 찾지 못하셨나요? 문의하기"

**완료 기준:**
- `/faq` 접속 시 페이지 표시
- 아코디언 열림/닫힘 작동
- 모바일 반응형

---

### Task 6: B2B/도매 페이지
**파일:** `/src/pages/wholesale.astro` (신규)

**체크리스트:**
- [ ] Hero 섹션: "시공업자 및 협력사 전용"
- [ ] 3개 섹션:
  - [ ] **파트너 혜택**
    - 대량 구매 할인 (10% 이상)
    - 전담 영업 담당자 배정
    - 우선 배송 및 재고 확보
    - 기술 지원 무료 제공
  - [ ] **협력 프로세스**
    - 1. 파트너 신청
    - 2. 조건 협의
    - 3. 계약 체결
    - 4. 전용 계정 발급
  - [ ] **B2B 견적 폼**
    - 회사명, 대표자명, 사업자번호
    - 연락처, 이메일
    - 취급 품목
    - 월 예상 주문량
    - 요청사항
- [ ] 제출 버튼 → calc.deckctr.com
- [ ] SEO 메타 태그

**완료 기준:**
- `/wholesale` 페이지 정상 표시
- 폼 필드 validation
- 모바일 반응형

---

### Task 7: 기술 자료실 페이지
**파일:** `/src/pages/resources.astro` (신규)

**체크리스트:**
- [ ] Hero: "기술 자료실"
- [ ] 카테고리별 자료 그리드:
  - [ ] **제품 사양서** (4개)
    - 목재 데크 사양서.pdf
    - 합성목 데크 사양서.pdf
    - 알루미늄 데크 사양서.pdf
    - 부자재 카탈로그.pdf
  - [ ] **시공 매뉴얼** (3개)
    - 기본 시공 가이드.pdf
    - 고급 시공 기법.pdf
    - 문제 해결 가이드.pdf
  - [ ] **인증서** (2개)
    - KS 인증서.pdf
    - 친환경 인증서.pdf
  - [ ] **유지보수** (2개)
    - 정기 관리 체크리스트.pdf
    - 계절별 관리 가이드.pdf
- [ ] 각 자료는 카드 형태로 표시
- [ ] 다운로드 아이콘 + 파일 크기 표시
- [ ] 실제 PDF는 `/public/resources/` 폴더에 배치 (더미 파일)

**완료 기준:**
- `/resources` 페이지 표시
- 카드 클릭 시 다운로드 (더미 파일)
- 모바일 반응형

---

### Task 8: 시공사례 확대 (5개 추가)
**파일:** `/src/content/cases/*.mdx` (5개 신규 파일)

**추가할 사례:**
1. [ ] **주거-목재**: `residential-wood-deck.mdx`
   - 제목: "단독주택 목재 데크 시공"
   - 위치: 경기 성남시
   - 면적: 20㎡
   - 자재: 방부목
   - 특징: 자연 친화적 디자인

2. [ ] **상업-합성목**: `commercial-composite-cafe.mdx`
   - 제목: "카페 테라스 합성목 데크"
   - 위치: 서울 강남구
   - 면적: 35㎡
   - 자재: WPC 합성목
   - 특징: 유지보수 간편, 고객 만족도 높음

3. [ ] **공공-알루미늄**: `public-aluminum-park.mdx`
   - 제목: "공원 산책로 알루미늄 데크"
   - 위치: 서울 송파구
   - 면적: 100㎡
   - 자재: 알루미늄 데크
   - 특징: 내구성 우수, 반영구적 수명

4. [ ] **주거-합성목**: `residential-wpc-terrace.mdx`
   - 제목: "아파트 베란다 합성목 시공"
   - 위치: 경기 분당
   - 면적: 12㎡
   - 자재: 중공 합성목
   - 특징: 무보수 10년 보증

5. [ ] **상업-목재**: `commercial-wood-restaurant.mdx`
   - 제목: "레스토랑 야외 테라스 목재 데크"
   - 위치: 서울 마포구
   - 면적: 28㎡
   - 자재: 이페목
   - 특징: 고급 분위기, 내후성 우수

**각 사례 frontmatter:**
```yaml
---
title: "사례 제목"
excerpt: "한 줄 설명"
cover: "/images/cases/case-name.jpg"
location: "지역"
area: "면적"
material: "자재"
duration: "기간"
gallery:
  - "/images/cases/case-name-1.jpg"
  - "/images/cases/case-name-2.jpg"
  - "/images/cases/case-name-3.jpg"
---
```

**완료 기준:**
- 5개 사례 MDX 파일 생성
- 각 사례 개별 페이지 접속 가능
- Cases 인덱스 페이지에 8개 사례 표시

---

## 🟢 PHASE 3: MEDIUM PRIORITY (2주 내 구현)

### Task 9: 접근성 개선
**파일:** 모든 컴포넌트, BaseLayout.astro

**체크리스트:**
- [ ] **Skip Navigation 링크**
  - BaseLayout.astro에 추가
  - `<a href="#main-content" class="skip-link">본문으로 건너뛰기</a>`
  - CSS: 포커스 시에만 표시

- [ ] **Focus Indicators**
  - BaseLayout.astro 전역 스타일에 추가
  - `:focus-visible` 스타일 (2px solid accent color)

- [ ] **색상 대비 개선**
  - `--color-text-light: #666` → `#595959` (WCAG AA 준수)

- [ ] **ARIA Labels 추가**
  - Hero 비디오: `aria-label="배경 비디오"`
  - 네비게이션: `<nav aria-label="주 메뉴">`
  - 푸터: `<footer aria-label="사이트 정보">`
  - 검색/필터: `aria-label` 추가

- [ ] **키보드 네비게이션 테스트**
  - Tab키로 모든 링크/버튼 접근 가능
  - Enter/Space로 활성화 가능
  - Escape로 모달/메뉴 닫기

**완료 기준:**
- Lighthouse Accessibility 점수 95+
- 키보드만으로 전체 사이트 탐색 가능

---

### Task 10: 보증/A/S 페이지
**파일:** `/src/pages/warranty.astro` (신규)

**체크리스트:**
- [ ] Hero: "보증 및 A/S 안내"
- [ ] 섹션 구성:
  - [ ] **제품별 보증 기간**
    - 목재 데크: 2년
    - 합성목 데크: 5년
    - 알루미늄 데크: 10년
  - [ ] **보증 범위**
    - 포함: 제조 결함, 자재 하자, 변색/변형
    - 제외: 시공 불량, 자연재해, 사용자 과실
  - [ ] **A/S 신청 절차**
    - 1. 온라인 또는 전화 신청
    - 2. 현장 확인 (2-3일 내)
    - 3. 보증 범위 판정
    - 4. 무상/유상 수리 진행
  - [ ] **반품/교환 정책**
    - 7일 이내 미개봉 제품
    - 왕복 배송비 고객 부담
    - 주문 제작 제품 제외
  - [ ] **A/S 신청 폼**
    - 이름, 연락처
    - 구매일, 주문번호
    - 제품명
    - 문제 설명
    - 사진 첨부 (선택)

**완료 기준:**
- `/warranty` 페이지 표시
- 폼 제출 (calc.deckctr.com 연결)
- 명확한 정보 전달

---

### Task 11: 회사 소개 강화
**파일:** `/src/pages/about.astro` (수정)

**현재 상태 확인 후 추가:**
- [ ] **회사 연혁** 섹션
  - 2010: 창립
  - 2015: 합성목 라인 확대
  - 2020: 알루미늄 데크 진출
  - 2025: 온라인 플랫폼 오픈

- [ ] **인증 및 수상** 섹션
  - KS 인증
  - ISO 9001
  - 친환경 인증
  - 우수 기업 선정 (년도)

- [ ] **비전/미션** 섹션
  - 미션: "최고 품질의 데크 자재로 공간의 가치를 높입니다"
  - 비전: "국내 1위 데크 전문 기업"
  - 핵심 가치: 품질, 신뢰, 혁신

- [ ] **팀 소개** (선택적)
  - 대표 소개
  - 핵심 팀 사진

**완료 기준:**
- `/about` 페이지 내용 풍성해짐
- 신뢰도 향상
- 모바일 반응형

---

### Task 12: 디자인 시스템 확장
**파일:** `/src/layouts/BaseLayout.astro`

**체크리스트:**
- [ ] **CSS 변수 추가**
  ```css
  /* Spacing Scale */
  --spacing-xs: 0.25rem;  /* 4px */
  --spacing-sm: 0.5rem;   /* 8px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */
  --spacing-2xl: 3rem;    /* 48px */
  --spacing-3xl: 4rem;    /* 64px */

  /* Shadow Scale */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
  --shadow-xl: 0 12px 32px rgba(0,0,0,0.15);

  /* Z-index Scale */
  --z-base: 1;
  --z-dropdown: 100;
  --z-sticky: 1000;
  --z-modal: 2000;
  --z-splash: 10000;

  /* Typography Scale */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 2rem;
  --font-size-4xl: 2.5rem;
  --font-size-5xl: 3.5rem;
  ```

- [ ] **Hero.astro CTA 스타일 통합**
  - Hero 컴포넌트의 인라인 `.cta` 스타일 제거
  - 대신 BaseLayout의 `.btn-primary` 사용

- [ ] **기존 하드코딩된 값들을 변수로 교체**
  - box-shadow → `var(--shadow-md)`
  - z-index → `var(--z-sticky)`
  - padding/margin → `var(--spacing-*)`

**완료 기준:**
- 모든 CSS 변수 정의 완료
- 최소 3개 컴포넌트에서 변수 사용
- 디자인 일관성 향상

---

## 🔵 PHASE 4: LOW PRIORITY (나중에 고려)

### Task 13-17: 추후 구현
- [ ] 뉴스레터 가입
- [ ] 라이브 채팅/챗봇
- [ ] 소셜 미디어 통합
- [ ] 추가 반응형 브레이크포인트
- [ ] 다크 모드 지원

---

## 📝 최종 검증 체크리스트

### 모든 페이지 공통
- [ ] 모바일 반응형 (768px 이하)
- [ ] SEO 메타 태그 (title, description, OG)
- [ ] ARIA labels 기본 적용
- [ ] 명확한 CTA 존재
- [ ] 일관된 디자인 (색상, 타이포그래피)
- [ ] Lighthouse Performance 90+
- [ ] 링크 모두 작동

### 브라우저 테스트
- [ ] Chrome (최신)
- [ ] Safari (최신)
- [ ] Firefox (최신)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### 커밋 전 확인사항
- [ ] 오타/문법 확인
- [ ] Console 에러 없음
- [ ] 빌드 성공 (`pnpm build`)
- [ ] 로컬 프리뷰 정상 작동 (`pnpm preview`)

---

## 📂 파일 구조 요약

```
/src
├── components/
│   ├── Header.astro ✅ (모바일 메뉴 추가됨)
│   ├── Footer.astro 🔄 (Contact 링크 추가 예정)
│   ├── Testimonial.astro 📝 (신규 생성 예정)
│   └── ...
├── pages/
│   ├── index.astro 🔄 (신뢰 신호 추가 예정)
│   ├── contact.astro 📝 (신규)
│   ├── faq.astro 📝 (신규)
│   ├── wholesale.astro 📝 (신규)
│   ├── resources.astro 📝 (신규)
│   ├── warranty.astro 📝 (신규)
│   └── about.astro 🔄 (내용 확장 예정)
├── content/
│   └── cases/
│       ├── case-01.mdx
│       ├── hannam-aluminum.mdx
│       ├── pangyo-cafe-wpc.mdx
│       ├── residential-wood-deck.mdx 📝 (신규)
│       ├── commercial-composite-cafe.mdx 📝 (신규)
│       ├── public-aluminum-park.mdx 📝 (신규)
│       ├── residential-wpc-terrace.mdx 📝 (신규)
│       └── commercial-wood-restaurant.mdx 📝 (신규)
└── layouts/
    └── BaseLayout.astro 🔄 (디자인 시스템 확장 예정)

/public
└── resources/ 📁 (신규 폴더 생성 예정)
    └── *.pdf (더미 파일들)
```

---

## 참고 자료
- [Top 10 B2B Website Design Trends for 2026](https://www.axongarside.com/blog/b2b-website-design-trends-2026)
- [18 Best B2B Websites in 2026](https://www.tilipmandigital.com/resource-center/articles/best-b2b-websites)
- [20 Best Deck Builder Website Designs](https://www.cyberoptik.net/blog/best-deck-builder-website-designs/)
