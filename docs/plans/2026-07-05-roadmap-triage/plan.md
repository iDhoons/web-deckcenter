---
executor: opus
size: M
depends_on: []
priority: P2
created: 2026-07-05
author: fable5-blitz-main
---

# deckctr roadmap-triage — DEC-870 결정 포함

## 1. 컨텍스트/근거
Paperclip **DEC-870("deckctr WIP 커밋/push 결정", 2026-07-05 마감)**이 오늘 만료되고, open plan 5개(최고령 142일)와 168일 정체 worktree가 방치돼 있다. 오늘(7/5) 오후 세션이 시네마틱 홈 리워크를 완료(커밋 25d16c8, Playwright 검증 통과 이력 있음)한 직후라 처분 적기다.

## 2. 현재 상태 실측 (2026-07-05 20:2x)
**확인한 사실**: main=b30dba3(clean, dirty 0). 브랜치 3: `feat/cinematic-home`(peer worktree, 25d16c8 "홈 시네마틱 씬 다크 프로덕트 필름으로 재작업" ← 39de9a2 "시네마틱 WPC 제조사 홈으로 리포지셔닝"), `claude`(in-repo worktree `.worktrees/claude`, e5cbe98, **168일 정체**). open plan 5: `2026-02-13-site-restructure-design`(142d), `2026-03-09-bid-collection-refactor`, `2026-07-03-ui-guidelines-review`, `2026-07-03-vercel-deployment`, `2026-07-03-website-completeness-improvements`.
**UNVERIFIED**: DEC-870 이슈 본문의 정확한 대상(제목상 WIP=cinematic-home으로 추정), `claude` 브랜치가 main에 머지됐는지, 142일 plan의 내용과 리포지셔닝 커밋의 중복도.

## 3. 결정 + 근거
| 결정 | 근거 | 기각 대안 |
|---|---|---|
| **DEC-870 답: cinematic-home을 cwt 리뷰 후 main 머지+push** | 오늘 완성·Playwright 검증 통과·커밋 완료 상태. 방치가 유일한 리스크 | 보류: WIP가 이미 WIP가 아님(완성 커밋) |
| site-restructure-design(142d)은 **cinematic 방향에 흡수 판정 권고** | 39de9a2 리포지셔닝이 사이트 구조 방향을 새로 정의함 — 142일 전 설계는 전제 소멸 개연성 | 계속 open: 죽은 계획이 로드맵 오염 |
| bid-collection-refactor는 **wpc-suppliers로 이관 검토** | 조달 수집은 `~/projects/research/wpc-suppliers`+수원 레이더가 현행 소유자(2026-07-05 WPC 묶음 계획 참조) — 마케팅 사이트 repo에 수집기가 있을 이유 약함 | 여기서 리팩터: 소유권 분산 지속 |

## 4. 실행 태스크
**T1. (오늘) DEC-870 종결**: `cwt`로 `feat/cinematic-home` diff 리뷰 → main 머지 → push → Paperclip DEC-870에 결정 코멘트 후 완료 처리.
→ 검증: `git log main --oneline -1`에 머지 반영 + push 성공 + 이슈 상태 done

**T2. vercel-deployment plan 실행 순서 확정**: 머지된 cinematic 홈을 배포 대상으로 명시(계획 내용 실측 후 태스크 조정).
→ 검증: 배포 URL에서 시네마틱 홈 렌더 확인(계획 문서의 검증 절차 따름)

**T3. `claude` worktree/브랜치 처분**: `git log main..claude --oneline`으로 미머지 커밋 확인 → 가치 없으면 `git worktree remove .worktrees/claude && git branch -D claude`(있으면 cherry-pick 판정).
→ 검증: `git worktree list`에서 소멸, 브랜치 목록에서 소멸

**T4. plan 5건 처분 실행**: §3 판정대로 — site-restructure(내용 5분 대조 후 `_status.cancelled.md`+흡수 사유), bid-collection(이관 태스크를 wpc-suppliers 쪽에 생성 후 여기선 cancelled), ui-guidelines·completeness는 T1~T2 뒤 순서로 open 유지+next_action 기입.
→ 검증: `ls docs/plans/*/_status.*.md` 5건이 판정표와 일치

## 5. 성공 기준
- DEC-870 오늘 내 종결(코멘트+상태 전환), 시네마틱 홈이 main+원격에 존재.
- open plan 5→2 이하, 전부 next_action 보유. stale worktree 0.

## 6. 리스크/롤백
- 머지는 cwt 리뷰 게이트 후에만(문서·코드 diff 눈검수). 문제 시 merge 커밋 revert.
- T3 브랜치 삭제 전 미머지 커밋 확인이 필수 게이트(무확인 -D 금지).

## 7. Open Questions
1. DEC-870 본문에 cinematic 외 다른 WIP가 명시돼 있는지 — T1에서 이슈 본문 확인 후 필요시 범위 추가.
2. site-restructure-design에 살릴 항목(잔존 가치)이 있는지 — T4 대조에서 판정.
