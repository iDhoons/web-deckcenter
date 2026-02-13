# Vercel 배포 상세 계획

> 데크센터(deckctr) Astro 5 정적 사이트 → Vercel 배포

---

## 1. 현재 상태 분석

### 프로젝트 요약

| 항목 | 값 |
|------|------|
| 프레임워크 | Astro 5.16 (Static SSG) |
| 빌드 시간 | ~5초 |
| 페이지 수 | 16페이지 |
| 출력 크기 | 109MB (dist/) |
| 비디오 에셋 | 92MB (public/videos/) |
| 패키지매니저 | pnpm 9.15.4 |
| 환경변수 | 2개 (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY) |

### 주의 사항

1. **비디오 파일 크기 (92MB)**: Vercel Hobby 플랜 소스 업로드 제한은 100MB. 현재 92MB로 매우 근접함
2. **입찰 페이지 (bids/index.astro)**: 빌드 시점에 Supabase에서 데이터 fetch → 다음 빌드 전까지 데이터 고정
3. **어댑터 불필요**: 순수 정적 사이트이므로 `@astrojs/vercel` 어댑터 없이 배포 가능

---

## 2. 배포 준비 작업

### Step 1: vercel.json 생성 (선택사항)

> Vercel은 Astro를 자동 감지하므로 vercel.json 없이도 배포 가능.
> 아래는 캐싱 최적화가 필요한 경우에만 추가.

```json
{
  "framework": "astro",
  "headers": [
    {
      "source": "/videos/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/_astro/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/images/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=604800" }
      ]
    }
  ]
}
```

**판단**: Astro가 이미 `/_astro/` 에셋에 해시를 포함하므로, 별도 헤더 없이도 Vercel CDN이 잘 처리함. 비디오 캐싱이 중요하면 추가.

### Step 2: 환경변수 설정

Vercel 대시보드 → Project Settings → Environment Variables에서 추가:

| Key | Environment | 설명 |
|-----|-------------|------|
| `PUBLIC_SUPABASE_URL` | Production, Preview, Development | Supabase 프로젝트 URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development | Supabase anon 공개 키 |

> `PUBLIC_` 접두사가 있으므로 클라이언트에 노출됨. anon key는 RLS로 보호되므로 정상.

### Step 3: 비디오 에셋 전략 결정

**옵션 A: 그대로 배포 (현재)**
- 장점: 단순함, 추가 설정 없음
- 단점: Hobby 플랜 100MB 제한 근접, 빌드 시 업로드 느림
- 적합: Pro 플랜 사용 시

**옵션 B: 외부 CDN으로 분리 (권장)**
- 비디오를 Cloudflare R2 / AWS S3 + CloudFront로 분리
- `public/videos/` 삭제 → URL을 외부 CDN으로 변경
- 장점: 배포 크기 대폭 감소, 더 빠른 빌드
- 단점: 추가 인프라 관리

**옵션 C: Vercel Blob Storage**
- Vercel 자체 스토리지 사용
- 장점: Vercel 에코시스템 내에서 관리
- 단점: 추가 비용

**당장 추천**: Hobby 플랜이면 옵션 B 필수. Pro 플랜이면 옵션 A로 충분.

### Step 4: 입찰 페이지 데이터 갱신 전략

현재 `bids/index.astro`는 빌드 시점에 Supabase 데이터를 가져옴 (SSG).

**옵션 A: 정기 재빌드 (간단)**
- Vercel Deploy Hook + Cron으로 매일/매시간 재빌드
- 설정: Vercel 대시보드 → Settings → Git → Deploy Hooks
- GitHub Actions나 Supabase Edge Function에서 hook 호출

**옵션 B: ISR (Incremental Static Regeneration)**
- `@astrojs/vercel` 어댑터 추가 + `output: 'hybrid'` 설정
- 입찰 페이지만 `export const prerender = false;`로 서버 렌더링
- 장점: 항상 최신 데이터
- 단점: 서버리스 함수 사용, Cold Start

**옵션 C: 클라이언트 사이드 fetch (현실적)**
- 빌드 시점 데이터를 초기값으로 사용
- 클라이언트에서 Supabase realtime/fetch로 최신 데이터 갱신
- 장점: 정적 배포 유지하면서 실시간 데이터
- 단점: 추가 JS 코드 필요

**당장 추천**: 옵션 A (Deploy Hook)로 시작 → 필요 시 옵션 C로 전환

---

## 3. 배포 프로세스

### 방법 1: Git 연동 (권장)

```bash
# 1. Vercel CLI 설치
pnpm add -g vercel

# 2. 로그인
vercel login

# 3. 프로젝트 연결
vercel link

# 4. GitHub repo와 연동
# → Vercel 대시보드에서 Import Git Repository
# → main 브랜치 push 시 자동 배포
```

### 방법 2: CLI 수동 배포

```bash
# Preview 배포
vercel

# Production 배포
vercel --prod
```

### 방법 3: GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          PUBLIC_SUPABASE_URL: ${{ secrets.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.PUBLIC_SUPABASE_ANON_KEY }}
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 4. 커스텀 도메인 설정

### DNS 설정 (deckctr.com)

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

또는 네임서버를 Vercel로 변경:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

### Vercel 대시보드 설정
1. Project Settings → Domains
2. `deckctr.com` 추가
3. `www.deckctr.com` 추가 (www → apex 리다이렉트 또는 반대)

---

## 5. 배포 후 체크리스트

- [ ] 모든 16페이지 정상 렌더링 확인
- [ ] 입찰 페이지 (bids/) Supabase 데이터 정상 로드
- [ ] 비디오 재생 확인 (hero-forest.mp4, forest-droneshot.webm)
- [ ] 다크/라이트 테마 토글 정상 동작
- [ ] 모바일 반응형 확인
- [ ] sitemap.xml, robots.txt, rss.xml 접근 가능
- [ ] OG 메타태그 확인 (소셜 미디어 공유 프리뷰)
- [ ] Lenis 스무스 스크롤 정상 동작
- [ ] Three.js 3D Hero 정상 렌더링
- [ ] ChatButton 플로팅 위젯 정상 동작
- [ ] 커스텀 도메인 SSL 인증서 발급 확인
- [ ] Lighthouse 점수 확인 (Performance, SEO, Accessibility)

---

## 6. 비용 예상

### Vercel Hobby (무료)
- 월 100GB 대역폭
- 일 100회 배포
- 소스 파일 100MB 제한 ← **비디오 때문에 타이트**

### Vercel Pro ($20/월)
- 월 1TB 대역폭
- 일 6,000회 배포
- 소스 파일 1GB 제한
- 팀 기능, 분석 포함

**추천**: 비디오 에셋(92MB) 때문에 Pro 플랜 권장. 또는 비디오를 외부 CDN으로 분리하면 Hobby로 충분.

---

## 7. 실행 우선순위

| 순서 | 작업 | 소요 시간 | 중요도 |
|------|------|-----------|--------|
| 1 | 환경변수 설정 | 5분 | 필수 |
| 2 | Git 연동 배포 | 10분 | 필수 |
| 3 | 커스텀 도메인 연결 | 15분 | 필수 |
| 4 | 비디오 에셋 전략 결정 | 30분~2시간 | 높음 |
| 5 | Deploy Hook 설정 | 10분 | 중간 |
| 6 | vercel.json 캐싱 헤더 | 5분 | 낮음 |
| 7 | GitHub Actions 파이프라인 | 20분 | 선택 |
