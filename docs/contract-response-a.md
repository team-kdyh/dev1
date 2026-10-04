# 트랙 A 계약 응답

`feat/track-c-implementation`의 [`docs/contract-decisions.md`](https://github.com/team-kdyh/dev1/blob/feat/track-c-implementation/docs/contract-decisions.md)를
읽고 **A(클라이언트) 입장에서** 답합니다.

> C의 문서가 "잠정 구현안, 팀 합의 전에는 승인된 공용 계약이 아니다"라고 명시했으므로,
> A는 아직 그 데이터를 코드에 붙이지 않았습니다. 주간 4인 동기화에서 확정되면 붙입니다.
> 지금 A의 `src/data/placeholderBalance.ts`는 그대로 플레이스홀더입니다.

---

## 1. C의 결정에 대한 A의 답

| ID | 결정 | A의 답 |
| --- | --- | --- |
| C-DEC-08 | AI 조합 판별용 `roles[]` 추가 (승인 필요: A/B) | **찬성.** A도 쓸 데가 있습니다 — 도감(§7)의 역할 필터와 유닛 버튼 아이콘 구분. enum 7종(`melee` `ranged` `siege` `support` `tank` `control` `ultimate`)을 그대로 UI 라벨로 쓰려면 **표시용 한글 이름**이 어딘가 있어야 합니다. `meta.json`에 `roleLabels` 같은 맵을 넣어주시면 A가 하드코딩하지 않아도 됩니다. |
| C-DEC-02 | 데이터 루트는 `/src/data` | **찬성.** 마스터 §12.3과 일치하고, A의 현재 플레이스홀더도 같은 위치입니다. |
| C-DEC-06 | 에셋은 논리 키로 참조 (`units.semicon.buds`) | **찬성이되 D와 3자 확인 필요.** A의 `unitTexture(faction, tier)`가 논리 키 기반으로 바뀌어야 합니다. A가 고칠 자리는 `src/render/textures.ts` 한 곳이고, 바깥 코드는 영향 없습니다. |
| C-DEC-01 / 04 / 09 | 스킬 분리, 방어 타입, 스킬 프리미티브 | **A 무관.** 전투 판정은 A가 관여하지 않습니다. 다만 도감(§7)이 스킬 이름·설명을 그대로 렌더하므로, 스킬 JSON에 **표시용 `name`과 `desc`** 가 있으면 됩니다. |
| C-DEC-03 / 05 / 07 / 10 | 난이도, 버전 관리, AI 주기, RNG | **A 무관.** |

---

## 2. A가 소비할 필드 — 이미 있어서 바로 쓸 수 있는 것

C의 데이터가 A의 "데이터 없어서 비워 둔 곳"을 정확히 채웁니다.

| A에서 비어 있던 것 | C의 데이터 | 비고 |
| --- | --- | --- |
| 업그레이드 패널(§4, R키)이 통째로 빔 | `upgrades.json` | `effect.type` 6종에 대한 **표시 문구**가 필요합니다. 3번 참고 |
| 전략 버튼이 "전략 1/2"로만 표시 | `factions.json`의 `strategySkills`, `strategies.json` | |
| 진영 색을 코드에 하드코딩(`blue`/`red`) | `factions.json`의 `colorPrimary` / `colorSecondary` | A의 원칙 위반 상태였습니다. 이걸로 걷어냅니다 |
| 도감(§7)의 스킬·상성이 "데이터 없음" | `skills/*.json`, `damage_matrix.json` | |
| 본진 시대별 모핑이 크기 변화로 대체 | `factions.json`의 `baseSprites.age1~4` | D의 스프라이트가 오면 연결 |
| 결과 화면 RP가 "데이터 없음" | `meta/research_tree.json` | RP **산출 규칙**은 아직 못 찾았습니다 |

---

## 3. A가 필요한데 지금 데이터에 없는 것

### 3.1 생산 소요 시간 — 확인 필요 (가장 중요)

`unit.schema.json`이 `additionalProperties: false`이고 required에 `cooldown` 하나뿐입니다.
**`cooldown`이 무엇인지 확정이 필요합니다.**

- (가) 생산에 걸리는 시간 — 큐에 들어간 뒤 유닛이 나올 때까지
- (나) 같은 버튼을 다시 누를 수 있게 되기까지의 시간

A는 이 둘을 **서로 다른 UI로** 그립니다.

- (가)라면 → §4.2 생산 큐의 선두 항목 진행도
- (나)라면 → §4.1 유닛 버튼의 원형 쿨다운 오버레이

지금 A는 둘 다 구현해 두었고 각각 다른 값을 기대합니다. 하나뿐이라면 둘 중 하나는
같은 값을 보게 되거나 비게 됩니다. **둘 다 필요한지, 하나로 합칠지 결정해 주세요.**
둘 다라면 `buildTime`(또는 `productionTime`) 필드 추가가 필요합니다.

> 진행도 수치 자체는 시뮬 스냅샷(`queue[].progress`)이 주므로 A가 계산하지는 않습니다.
> 다만 도감이 "생산 시간"을 표시하려면 밸런스 데이터에 값이 있어야 합니다.

### 3.2 티어 해금 조건의 표시 문구 — 해결됨

명세 §4.1은 미해금 유닛 버튼에 **"자물쇠 + 조건 툴팁"** 을 요구합니다.

`ages.json`의 `tiers[]`(시대 2 → 티어 4,5,6)와 `name`(모바일 시대)으로
**"모바일 시대 필요"** 를 데이터에서 그대로 만들었습니다
([`src/ui/ageLabels.ts`](../src/ui/ageLabels.ts)). **추가 요청 없습니다.**

데이터에 없는 티어면 아무것도 표시하지 않습니다 — 문구를 지어내지 않습니다.

### 3.3 업그레이드 효과의 표시 문구

`effect.type`이 `cashRateFlat` `unitHpPct` `unitAtkPct` `productionCooldownPct`
`supplyCapFlat` `baseTurretLevel` 6종입니다. A가 이걸 한글로 바꾸려면 코드에
매핑 테이블을 적어야 하는데, 그건 A의 "숫자와 문구는 코드에 없다" 원칙에 어긋납니다.

`upgrades.json`의 각 항목에 **`desc`** 를 넣어주시거나, `effect`별 표시 템플릿을
`meta.json`에 두면 A가 그대로 렌더합니다.

### 3.4 `roles[]`의 표시 이름

C-DEC-08 항목 참고. enum 값을 UI에 그대로 노출할 수는 없습니다.

### 3.5 업그레이드 보유 레벨 — B에게 (추가 요청)

`upgrades.json`을 패널에 연결하면서 발견했습니다. 각 업그레이드는 `maxLevel`과
단계별 `costs[]`를 갖는데, **플레이어가 지금 몇 레벨인지가 스냅샷에 없습니다.**

그래서 A는 현재 단계별 비용을 전부 나열하고(`250 / 600 / 1200`), 구매 가능 판정을
하지 않습니다. 레벨을 모르면 "다음 단계 비용"을 고를 수 없기 때문입니다.

**요청:** `PlayerSnapshot`에 `upgradeLevels: Record<string, number>`
(업그레이드 ID → 보유 레벨)를 추가해 주세요. 그러면 A가
"생산 라인 Lv.1 → 다음 600"처럼 그리고, 비용이 모자라면 흑백 처리할 수 있습니다.

`BUY_UPGRADE`의 거부 사유도 필요합니다. 최종 레벨에 도달한 업그레이드를 또 사려 할 때
`RejectReason`에 무엇이 오는지 확정 부탁드립니다 — 현재 enum에는 해당하는 값이 없습니다.

---

## 4. A가 B에게 요청하는 것 (변동 없음)

C의 문서 "트랙 B 연결 체크리스트"의 `SimulationSnapshot` 필드 확정과 겹칩니다.
A가 HUD를 그리려면 아래가 스냅샷에 있어야 합니다. A측 초안은
[`src/sim/contracts.ts`](../src/sim/contracts.ts)에 있습니다.

- `PlayerSnapshot`: `cooldowns`(defId → 남은 ms), `unlockedTiers`, `queue[].progress`,
  `supply` / `supplyMax`
- `UnitSnapshot`: `facing`, `state`, `maxHp`
- `ProjectileSnapshot`: `progress`(0~1) — 프론트가 포물선 Y를 만드는 유일한 근거
- `rejected` 이벤트에 `reason`
- **Y 좌표는 스냅샷에 넣지 말 것.** 프론트가 id 기반 결정론적 오프셋으로 부여합니다(§2.1)

### 단위 확인

`meta.json`의 `laneLength: 1000`은 A의 논리 좌표계와 일치합니다(A는 이걸 월드 4000px로 변환).
`stats.range`(20~300)와 `moveSpeed`(40~95)가 **같은 논리 단위 기준인지**,
`moveSpeed`가 초당인지 틱당인지 확정 필요합니다. A는 초당 논리단위로 가정하고 있습니다.

---

## 5. 합의되면 A가 할 일

1. `src/data/placeholderBalance.ts`를 C의 JSON 로더로 교체
2. `src/render/textures.ts`의 하드코딩된 진영 색을 `factions.json`에서 읽도록 변경
3. 업그레이드 패널·전략 버튼·도감의 "데이터 없음" 자리를 실제 데이터로 채움
4. 유닛 버튼에 해금 조건 툴팁 추가(§4.1)

A쪽 렌더러와 HUD는 **이미 다 만들어져 있습니다.** 데이터만 꽂으면 됩니다.
