# 플레이 가능한 만화풍 빌드 인계

2026-10-04 기준 웹 클라이언트는 로컬 전투 시뮬레이션, 18종 캐릭터 아틀라스, 전투 음악과 효과음을 연결한다. 밝은 만화풍 배경·본진·메뉴를 적용했고 작은 화면에서는 생산 카드를 넘겨 볼 수 있다.

첫 적 유닛도 시작과 함께 생산하도록 맞춰 양쪽 군단이 본진 앞이 아닌 전선에서 만난다. 카메라는 진영에 관계없이 아군 선두를 화면에 남겨 두고, 교전이 가까워지면 양쪽 선두 사이를 부드럽게 따라간다. 원거리 공격은 시뮬레이션이 보낸 실제 목표 좌표까지 짧은 전자광선을 그린다.

## 실행

Node.js 24 이상에서 저장소 루트에서 실행한다.

```bash
npm ci
npm run dev
npm run check
npm run audit:pve -- --matches=40 --difficulty=hard
npm run preview
```

빠른 대전은 진영을 고른 뒤 바로 시작한다. 숫자키 1~9 또는 하단 카드로 유닛을 생산하고, Q/W로 전략, E로 시대 상승, R로 업그레이드, 스페이스로 전선 복귀를 사용한다. 설정에서 음악과 효과음 크기를 조절할 수 있으며 값은 브라우저에 저장된다.

## 화면 확인

- [메인 메뉴](../assets/previews/game-comic-menu.png)
- [데스크톱 전투](../assets/previews/game-comic-battle-desktop.png)
- [좁은 화면 전투](../assets/previews/game-comic-battle-mobile.png)
- [개선된 첫 교전 · 데스크톱](../assets/previews/game-comic-first-clash-desktop.png)
- [개선된 첫 교전 · 좁은 화면](../assets/previews/game-comic-first-clash-mobile.png)
- [캠페인 전투 안내](../assets/previews/game-campaign-tutorial.png)
- [일시정지 메뉴](../assets/previews/game-pause-menu.png)

## 연결 위치

| 영역 | 주요 파일 |
| --- | --- |
| 전투 규칙과 AI | `src/adapter/LocalSimAdapter.ts`, `src/data/gameData.ts` |
| 캐릭터와 전투 화면 | `src/render/textures.ts`, `src/render/UnitView.ts`, `src/render/scenery.ts` |
| 전선 추적과 원거리 타격 연출 | `src/render/frontline.ts`, `src/render/ProjectileLayer.ts` |
| 사운드와 설정 | `src/audio/GameAudio.ts`, `src/audio/settings.ts` |
| 메뉴와 HUD | `src/screens/`, `src/ui/` |
| 배포 에셋 복사 | `tools/copy-runtime-assets.mjs` |

`npm run check`에서 밸런스 검증 오류 0건, 타입 검사 통과, 테스트 42개 통과, 클라이언트·밸런스 편집기 빌드 성공을 확인했다. 배포 빌드에는 게임이 참조하는 정적 파일 176개(14.2 MiB)를 담는다. 초기 자동 대전의 첫 유닛은 양쪽 모두 약 1.5초에 등장한다. Chrome에서 개발·배포 빌드의 메뉴 → 캠페인 → 전투 안내 → 생산 → 일시정지 경로를 확인했고 런타임 예외는 없었다. 도감 이미지 18개, 캠페인 카드 24개와 설정 저장·재열기는 이전 검수에서 확인했다.

## 현재 범위

24개 캠페인 스테이지, 연구소, 빠른 PvE 대전이 동작한다. 온라인 대전과 리플레이는 아직 지원하지 않아 메뉴에 표시하지 않는다. 밸런스와 공개 배포 전 점검 항목은 [출시 준비 점검](RELEASE_READINESS.md)을 참조한다.
