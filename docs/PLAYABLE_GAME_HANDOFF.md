# 플레이 가능한 만화풍 빌드 인계

2026-10-04 기준 웹 클라이언트는 로컬 전투 시뮬레이션, 18종 캐릭터 아틀라스, 전투 음악과 효과음을 연결한다. 남색·전기 파랑·코럴의 아케이드 화면과 노을 도시 전장을 적용했고 작은 화면에서는 생산 카드를 넘겨 볼 수 있다.

첫 적 유닛도 시작과 함께 생산하도록 맞춰 양쪽 군단이 본진 앞이 아닌 전선에서 만난다. 카메라는 진영에 관계없이 아군 선두를 화면에 남겨 두고, 교전이 가까워지면 양쪽 선두 사이를 부드럽게 따라간다. 원거리 공격은 시뮬레이션이 보낸 실제 목표 좌표까지 짧은 전자광선을 그린다.

빠른 전투 조정에서는 이동 속도를 높이고 같은 진영 유닛의 겹침을 허용했다. 출격 지점이 붐벼도 생산이 멈추지 않으며 겹친 유닛도 각각 공격한다. 체력 막대는 피해를 받은 캐릭터에만 보여 전선이 빽빽할 때 화면을 덜 가린다. 일반 대전의 성 체력은 5,000에서 3,000으로, 제한 시간은 5분에서 4분으로 줄였다. 캠페인 일반 스테이지의 성 체력도 40% 낮췄다.

UI는 진영별 색을 쓰는 메뉴·생산 카드, 어두운 전투 계기판, 전선 이름이 붙은 미니맵으로 통일했다. 모바일에서는 전략·시대 버튼과 미니맵을 상단으로 옮기고 지면을 올려 캐릭터가 조작 버튼에 가려지지 않게 했다. 전투 HUD의 시대 표기도 실제 시대 값에 맞게 고쳤다.

생성 이미지로 삼성 갤럭시 모양의 파란 성, 애플 아이폰 모양의 코럴 성, 진영별 생산 카드를 제작했다. 성에는 후면 카메라 배치와 전투 표정을 넣고, 두 진영 이름을 전장·HUD에 표시한다. 선택 화면의 명칭도 삼성·갤럭시와 애플·아이폰으로 바꿨다. 카드의 투명 여백을 잘라 작은 화면에서 그림과 가격을 더 크게 보여준다. 원본 파일과 제작 설명은 [게임 UI 에셋](../assets/game-ui/README.md)에 있다.

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

- [새 진영 선택 화면](../assets/previews/game-generated-faction.png)
- [삼성 성·생산 카드](../assets/previews/game-generated-samsung.png)
- [애플 성](../assets/previews/game-generated-apple.png)
- [모바일 생산 카드](../assets/previews/game-generated-mobile.png)
- [새 메인 메뉴](../assets/previews/game-arcade-menu.png)
- [새 데스크톱 전투](../assets/previews/game-arcade-battle-desktop.png)
- [새 모바일 전투](../assets/previews/game-arcade-battle-mobile.png)
- [새 모바일 일시정지](../assets/previews/game-arcade-pause-mobile.png)
- [캠페인 전투 안내](../assets/previews/game-campaign-tutorial.png)

## 연결 위치

| 영역 | 주요 파일 |
| --- | --- |
| 전투 규칙과 AI | `src/adapter/LocalSimAdapter.ts`, `src/data/gameData.ts` |
| 캐릭터와 전투 화면 | `src/render/textures.ts`, `src/render/UnitView.ts`, `src/render/scenery.ts` |
| 전선 추적과 원거리 타격 연출 | `src/render/frontline.ts`, `src/render/ProjectileLayer.ts` |
| 사운드와 설정 | `src/audio/GameAudio.ts`, `src/audio/settings.ts` |
| 메뉴와 HUD | `src/screens/`, `src/ui/` |
| 배포 에셋 복사 | `tools/copy-runtime-assets.mjs` |

`npm run check`에서 밸런스 검증 오류 0건, 타입 검사 통과, 테스트 40개 통과, 클라이언트·밸런스 편집기 빌드 성공을 확인했다. 배포 빌드에는 게임이 참조하는 정적 파일 180개(16.9 MiB)를 담는다. 초기 자동 대전의 첫 유닛은 양쪽 모두 약 1.5초에 등장하고 첫 교전은 약 4초에 시작한다. Chrome에서 배포 빌드의 데스크톱 진영 선택·양 진영 성·전투와 390px 모바일 생산 카드를 다시 확인했고 런타임 예외는 없었다. 도감 이미지 18개, 캠페인 카드 24개와 설정 저장·재열기는 이전 검수에서 확인했다.

## 현재 범위

24개 캠페인 스테이지, 연구소, 빠른 PvE 대전이 동작한다. 온라인 대전과 리플레이는 아직 지원하지 않아 메뉴에 표시하지 않는다. 밸런스와 공개 배포 전 점검 항목은 [출시 준비 점검](RELEASE_READINESS.md)을 참조한다.
