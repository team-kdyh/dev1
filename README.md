# 트랙 A — 클라이언트 (프론트엔드)

마스터 기능명세서의 §2.4, §10, §12를 담당하는 **렌더러 + HUD + 입력** 레이어입니다.
역할 정의는 [내역할기능명세서.md](내역할기능명세서.md), 개발 과정과 판단 근거는 [docs/DEVLOG.md](docs/DEVLOG.md)에 있습니다.

> **한 줄 정의** 스냅샷을 그림으로, 입력을 커맨드로. 시뮬 내부를 모른다.

---

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

| 스크립트 | 하는 일 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 (HMR) |
| `npm run build` | 타입체크 + 프로덕션 빌드 → `dist/` |
| `npm run typecheck` | `tsc --noEmit` 만 |

시뮬레이션이 아직 없어도 **그냥 실행됩니다.** `FakeSimAdapter`가 가짜 스냅샷을 30tick으로 뱉기 때문입니다.
에셋도 없어도 됩니다. 유닛은 진영 색 + 티어 숫자가 적힌 색 블록으로 나옵니다.

**조작:** `1~9` 유닛 생산 · `Q/W` 전략 · `E` 시대 업 · `R` 업그레이드 · `ESC` 일시정지 ·
`←→`/드래그 카메라 · `Space` 자동 추적 복귀 · 우클릭(또는 길게 누르기) 유닛 정보

---

## 모듈 구조

마스터 §12.3을 따릅니다. `adapter` / `input` / `app` / `screens`는 트랙 A 내부 분할입니다.

```
src/
  sim/contracts.ts   ← B 소유. A는 여기서 타입만 가져온다 (아래 "경계" 참고)
  adapter/           ← 시뮬과 프론트를 잇는 유일한 지점
  render/            ← PixiJS. 스냅샷을 읽기만 한다
  ui/                ← 인게임 HUD (Pixi)
  input/             ← 키/포인터 → Command
  screens/           ← 메뉴·도감·결과 (DOM)
  app/               ← 조립과 화면 전환
  data/              ← C의 밸런스 JSON이 들어올 자리 (지금은 플레이스홀더)
```

### 왜 HUD는 Pixi이고 메뉴는 DOM인가

인게임 HUD는 카메라 셰이크·슬로우모션·화면 플래시와 **같이 움직여야** 하므로 캔버스 안에 둡니다.
반면 도감은 18종 리스트 + 필터 + 스크롤이라 DOM이 압도적으로 빠릅니다.
`index.html`의 `#ui-root`가 캔버스 위에 겹쳐 있고, 메뉴 계열은 전부 거기 붙습니다.

---

## 경계 — 다른 트랙이 알아야 할 규칙

### 1. A는 `/sim` 내부를 import하지 않습니다

`contracts.ts`에서 **타입만** 가져옵니다. 계약 상수(`TICK_HZ`, 논리 좌표계 상한)는 값이라
[`src/adapter/SimAdapter.ts`](src/adapter/SimAdapter.ts)에 A측 사본으로 복제해 뒀습니다.

> **B에게:** 이 상수를 바꾸면 A도 같이 고쳐야 합니다. 계약 회의에서 "상수도 계약에 포함"으로
> 정하면 이 복제를 없앨 수 있습니다.

### 2. 프론트는 게임 상태를 만들지 않습니다

- 스냅샷을 수정하지 않습니다. 프론트가 소유하는 건 **뷰의 수명**과 **Y 좌표**뿐입니다.
- 유닛의 Y는 시뮬에 없습니다. `laneY(unitId)`가 id 기반 결정론적 오프셋을 부여합니다.
- 버튼 활성 상태는 프론트가 계산하지만 **실제 거부는 시뮬이 합니다.** 프론트 판정과 시뮬의
  `rejected` 사유가 어긋나면 콘솔에 `[§4.1 판정 불일치]` 경고가 찍힙니다. 그게 찍히면 버그입니다.
- 전투 결과를 추측하지 않습니다. `SimEvent`를 연출로 바꾸기만 합니다.

### 3. 숫자는 코드에 없습니다

유닛 이름·비용·스탯은 전부 `BalanceData`에서 읽습니다. 도감도 마찬가지라, C가 필드를 추가하면
A가 코드를 고치지 않아도 화면에 나타납니다.

---

## 지금 되는 것

M0 DoD 4개 전부 + 역할 명세 §2~§8 구현 완료.

- 레이어 9층 렌더링, 30tick↔60fps 보간, x 정렬, 뷰포트 컬링
- 카메라: 자동 추적 / 수동 / 4초 무입력 복귀 / 셰이크 / T9 슬로우 / 종료 줌인
- HUD: 캐시·인구·시대·본진 HP·타이머 / 유닛 버튼 5상태 / 생산 큐 / 미니맵 / 경고 /
  전략·업그레이드·일시정지·유닛정보 패널
- 연출 9종: `spawn` `hit` `kill` `skill` `ageup` `baseHit` `strategy` `rejected` `gameOver`
- 화면 흐름: 스플래시 → 메인메뉴 → 도감/연구소/설정 → 인게임 → 결과
- 더미 유닛 40기에서 60fps

## 지금 막혀 있는 것 — 다른 트랙 대기

여기 있는 항목은 **데이터가 없어서** 비어 있습니다. 지어내면 "숫자는 코드에 없다" 원칙이
깨지므로, 화면에 "데이터 없음"이라고 표시하고 필드가 오면 자동으로 채워지게 해뒀습니다.

| 막힌 것 | 필요한 것 | 누구 |
| --- | --- | --- |
| `LocalSimAdapter` 교체 | `Simulation` 클래스 | B |
| 투사체·스킬 연출 검증 | 시뮬이 내보내는 `projectiles`와 `skill` 이벤트 | B |
| 업그레이드 패널 항목 | `BalanceData.upgrades` | C |
| 도감의 스킬·상성 | `UnitDef.skills`, `UnitDef.counters` | C |
| 결과 화면 RP | RP 산출 규칙 | C |
| 진영 이름/유닛 (지금 `blue`/`red`) | 세미콘·오차드 밸런스 JSON | C |
| 정식 스프라이트·사운드 | 진영별 아틀라스 1장 (2048×2048) | D |

렌더러 쪽은 **이미 다 만들어져 있습니다.** 데이터만 꽂으면 됩니다.
교체 지점은 [`src/app/App.ts`](src/app/App.ts)의 어댑터 생성 한 줄입니다.

---

## B에게 — 계약에 꼭 있어야 하는 필드

없으면 HUD를 그릴 수 없는 것들입니다. 현재 A측 초안
[`src/sim/contracts.ts`](src/sim/contracts.ts)에 반영해 뒀습니다.

- `PlayerSnapshot`: `cooldowns`(defId → 남은 ms), `unlockedTiers`, `queue[].progress`,
  `supply` / `supplyMax`
- `UnitSnapshot`: `facing`, `state`, `maxHp`
- `ProjectileSnapshot`: `progress`(0~1) — 프론트가 포물선 Y를 만드는 유일한 근거
- `rejected` 이벤트에 `reason` 포함
- **Y 좌표는 시뮬에 넣지 마세요.** 프론트 소관입니다.
