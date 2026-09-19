# 03. 게임 디자이너 (밸런스 · AI · 콘텐츠) 기능명세서

**담당 트랙** C
**소유 디렉토리** `/src/data`, `/src/ai`, `/tools`**한 줄 정의** 숫자와 판단을 만든다. 시뮬 코드를 고치지 않고 게임을 바꾼다.
**겸임** 일정·이슈 관리(PM)
**관련 문서** 마스터 기능명세서 §3, §5, §6, §7, §9, §11, §13

---

## 0. 이 역할의 절대 원칙

1. **모든 수치는 JSON에 있다.** 코드에 하드코딩된 숫자를 발견하면 이슈를 연다.
2. 새 유닛/스킬 추가에 시뮬 코드 수정이 필요하면, 그건 시뮬의 프리미티브가 부족한 것이다. B에게 요청.
3. AI는 **사람과 똑같은 커맨드만** 쓴다. 자원 치팅, 시야 치팅 없음.
4. 밸런스 주장은 **배치 시뮬 표본**으로 한다. "느낌상 약한 것 같다"는 근거가 아니다.

---

## 1. 밸런스 데이터 스키마 (이 문서가 소유)

변경 시 4명 전원 합의 + `schemaVersion` 상승.

### 1.1 파일 구조

```
/src/data
  /balance
    meta.json            ← schemaVersion, 전역 상수
    units/
      semicon.json       ← 9종
      orchard.json       ← 9종
    factions.json
    upgrades.json
    strategies.json
    damage_matrix.json
  /campaign
    stages.json          ← 24스테이지
  /meta
    research_tree.json
  schema/
    unit.schema.json     ← ajv 검증용
    ...
```

### 1.2 유닛 스키마 (마스터 §11.1 기준, 확정판)

```json
{
  "$schema": "../schema/unit.schema.json",
  "id": "semicon_t5_fold",
  "faction": "semicon",
  "tier": 5,
  "name": "폴드 방패병",
  "desc": "접었다 펴며 태세를 바꾸는 최전방 탱커",
  "cost": 320,
  "supply": 2,
  "cooldown": 4.0,
  "stats": {
    "hp": 900,
    "armor": 12,
    "armorClass": "heavy",
    "atk": 30,
    "atkSpeed": 0.8,
    "range": 25,
    "moveSpeed": 55,
    "dmgType": "melee",
    "targetType": "splash",
    "splashRadius": 120,
    "targetPolicy": "nearest"
  },
  "skills": ["fold_toggle"],
  "assets": {
    "sprite": "units/semicon/fold",
    "sfxAttack": "sfx/fold_slam.ogg",
    "sfxDeath": "sfx/screen_crack.ogg"
  }
}
```

### 1.3 스킬 스키마 (B의 프리미티브 조합)

```json
{
  "id": "fold_toggle",
  "name": "접었다 폈다",
  "trigger": "passive_toggle",
  "interval": 2.0,
  "effects": [
    { "type": "toggleState", "states": [
      { "name": "folded",   "damageTakenMod": -0.40, "canAttack": false, "moveSpeedMod":  0.30 },
      { "name": "unfolded", "damageTakenMod":  0.00, "canAttack": true,  "moveSpeedMod": -1.00 }
    ]}
  ]
}
```

**사용 가능한 이펙트 프리미티브 10종** (B 제공)
`damage` / `heal` / `applyStatus` / `statMod` / `summon` / `toggleState` / `addStack` / `resetCooldown` / `changeOwner` / `healAll`

> 18종 스킬(마스터 §5.2, §6.2)이 전부 이 조합으로 표현되어야 한다. 표현 불가한 게 나오면 M1 1주차에 B에게 프리미티브 추가 요청.
> 

### 1.4 검증기

```bash
npm run validate:balance
```

- ajv 스키마 검증
- 교차 검증: 존재하지 않는 skillId 참조, 티어 중복, 비용 역전(고티어가 더 쌈), 에셋 경로 누락
- CI에 포함. 실패 시 머지 차단.

### 1.5 밸런스 에디터 (M0 1주차 툴)

간단한 웹 테이블 UI. 유닛 18종을 스프레드시트처럼 편집 → JSON 내보내기.

- 수정 즉시 검증 통과 여부 표시
- 진영 비교 뷰 (같은 티어 나란히)
- DPS/HP·비용 효율 자동 계산 컬럼

> 이 툴이 있으면 밸런싱 반복 속도가 몇 배 빨라진다. M0에 만드는 게 이득이다.
> 

---

## 2. AI 설계 (마스터 §9)

### 2.1 구조

```
AI는 Simulation을 읽고 TickInput을 생성하는 순수 함수 집합.
매 0.5초(15틱)마다 1회 평가.

evaluate(snapshot) →
  [상황 지표] frontLine, powerRatio, cash, enemyComposition
    ↓
  [전략 상태] DEFEND / BUILD / PRESSURE / PUSH
    ↓
  [행동 선택] 가중 랜덤 (Rng 사용 — 시뮬의 Rng를 공유해야 결정론 유지)
    ↓
  Command
```

### 2.2 상황 지표

```tsx
interface AiContext {
  frontLine: number;        // 0~1, 0=내 본진 앞, 1=적 본진 앞
  powerRatio: number;       // 내 병력 전투력 / 적 병력 전투력
  cash: number;
  cashRate: number;
  supplyFree: number;
  enemyComp: { melee: number; ranged: number; siege: number; support: number };
  myComp: { ... };
  timeElapsed: number;
}
```

전투력 산식(임시): `Σ (hp * atk * atkSpeed) / 1000`

### 2.3 전략 상태 전이

| 상태 | 진입 조건 | 행동 |
| --- | --- | --- |
| `DEFEND` | frontLine < 0.30 | 저티어 물량 즉시 생산, 방어 시설 업그레이드, 전략 스킬 즉시 사용 |
| `BUILD` | 0.30 ≤ frontLine ≤ 0.70 && powerRatio ≥ 1.0 | 시대 해금·업그레이드에 캐시 투자, 최소 병력만 유지 |
| `PRESSURE` | powerRatio ≥ 1.2 && cash 여유 | 고티어 유닛 생산, 라인 압박 |
| `PUSH` | frontLine > 0.75 | 공성 유닛 집중, 전략 스킬 전부 소진, 캐시 전액 투입 |

히스테리시스 필수: 상태 전환 후 3초간 재전환 금지 (깜박임 방지).

### 2.4 카운터 테이블 (마스터 §9.2)

```json
{
  "counters": {
    "melee_heavy":  [{ "unit": "t6_artillery", "w": 40 }, { "unit": "t3_basic", "w": 30 }],
    "ranged_heavy": [{ "unit": "t5_tank", "w": 50 }, { "unit": "t1_swarm", "w": 20 }],
    "siege_heavy":  [{ "unit": "t4_sniper", "w": 45 }, { "unit": "t7_mobile", "w": 30 }],
    "tank_heavy":   [{ "unit": "t8_siege", "w": 55 }, { "unit": "t7_deploy", "w": 25 }],
    "ultimate":     [{ "unit": "t8_control", "w": 60 }]
  }
}
```

가중치는 데이터. AI 로직을 고치지 않고 카운터 성향을 조정할 수 있어야 한다.

### 2.5 난이도 (마스터 §9.3)

| 난이도 | 반응 지연 | 자원 효율 | 카운터 정확도 | 전략 스킬 | 유닛 액티브 |
| --- | --- | --- | --- | --- | --- |
| 이지 | 2.5초 | 60% | 30% | 거의 안 씀 | 안 씀 |
| 노멀 | 1.2초 | 85% | 60% | 상황 판단 | 가끔 |
| 하드 | 0.5초 | 98% | 85% | 최적 타이밍 | 적극 |
| 익스퍼트 | 0.3초 | 95% | 95% | 최적 | 최적 |

**자원 효율 구현**: 100%면 항상 최선의 구매, 60%면 40% 확률로 차선/무의미한 선택.
**익스퍼트 카운터 95%**: 100%로 하면 사람이 이길 수 없고 재미가 없다. 의도적으로 빈틈을 남긴다.

### 2.6 AI 재활용

M3에서 PvP 이탈자 대리 조작에 **노멀 AI를 그대로** 투입한다. 그래서 AI가 커맨드만 뱉는 구조여야 한다.

---

## 3. 자동 대전 시뮬레이터 (툴)

B의 headless 러너 위에서 동작.

```bash
npm run batch -- --n 1000 --p0 semicon --p1 orchard --ai normal --out report.csv
```

### 3.1 리포트 항목

| 지표 | 목표 범위 |
| --- | --- |
| 진영별 승률 | 50% ± 5% |
| 미러전 승률 | 50% ± 3% |
| 평균 게임 길이 | 4~8분 |
| 유닛별 픽률 | 모든 유닛 > 3% (0%면 재설계 대상) |
| 유닛별 비용대비 처치 | 극단값 ±40% 이내 |
| Age 2 진입 시점 | 60~90초 |
| Age 3 진입 시점 | 150~210초 |
| 단일 유닛 스팸 승률 | < 40% (하드 AI 상대) |

### 3.2 밸런스 회귀 테스트

밸런스 JSON 변경 시 CI가 200판 자동 실행 → 승률이 45~55% 이탈하면 경고 코멘트.

---

## 4. 캠페인 설계 (M2)

진영당 12스테이지, 총 24스테이지.

### 4.1 스테이지 스키마

```json
{
  "id": "semicon_07",
  "faction": "semicon",
  "name": "리콜 사태",
  "desc": "T5 이상 유닛을 사용할 수 없다",
  "enemyFaction": "orchard",
  "aiDifficulty": "normal",
  "rules": {
    "startCash": 300,
    "cashRateMod": 1.0,
    "baseHp": 5000,
    "enemyBaseHp": 5000,
    "timeLimit": 480,
    "bannedUnits": ["semicon_t5_fold", "semicon_t6_artillery", "..."],
    "startAge": 1
  },
  "rewards": { "rp": 120, "firstClearRp": 200 },
  "unlockRequires": ["semicon_06"]
}
```

### 4.2 난이도 곡선

| 스테이지 | AI 난이도 | 특수 규칙 |
| --- | --- | --- |
| 1~3 | 이지 | 튜토리얼 (티어 해금 유도, 상성 학습) |
| 4~6 | 이지~노멀 | 자원 제약, 시간 제한 |
| 7~9 | 노멀 | 유닛 밴, 적 본진 HP 증가 |
| 10~11 | 하드 | 복합 제약 |
| 12 | 익스퍼트 | 보스전: 적 본진 HP 2배 + 전용 유닛 |

**특수 규칙 아이디어** (마스터 §9.4)
재고 부족(시작 캐시 100, 수급 +50%) / 리콜 사태(T5+ 금지) / 신제품 발표일(3분 제한) / 특허 분쟁(업그레이드 금지) / 공급망 차질(생산 쿨 2배, 비용 -40%)

---

## 5. 메타 시스템 (마스터 §13)

### 5.1 연구소 트리

```json
{
  "id": "initial_capital",
  "name": "초기 자본",
  "faction": "semicon",
  "levels": [
    { "cost": 100, "effect": { "startCash": 50 } },
    { "cost": 250, "effect": { "startCash": 100 } },
    { "cost": 500, "effect": { "startCash": 150 } }
  ],
  "requires": []
}
```

### 5.2 PvP 격리 규칙

- **랭크 대전: 메타 업그레이드 전면 비활성.** 순수 실력 매치.
- 빠른 대전: 적용
- 이 규칙이 지켜지지 않으면 PvP가 grind-to-win이 된다. 설계 초기부터 플래그로 분리.

---

## 6. PM 겸임 업무

| 주기 | 업무 |
| --- | --- |
| 매일 | 이슈 보드 정리, 블로커 식별 |
| 주 1회 | 4인 동기화 미팅 (30분) — 계약 변경 논의는 여기서만 |
| 마일스톤 종료 | DoD 체크리스트 검증, 회고 |
| 상시 | 계약 3종 버전 관리, 변경 공지 |

**블로커 감시 포인트**

- M0 3일차: 계약 3종 확정됐나? → 안 됐으면 최우선 처리
- M0 종료: headless 러너 나왔나? → 없으면 C의 M1이 전부 지연
- M0 종료: 플레이스홀더 18종 나왔나? → 없으면 A의 M1이 지연
- M1 3주차: 프론트-시뮬 연결 성공했나? → 최대 리스크 구간
- M2 2주차: 결정론 감사 CI 통과했나? → 실패면 M3 착수 연기

---

## 7. 마일스톤별 작업

### M0 (2주) — 밸런스 스키마 확정, 18종 수치 1차안

| 주 | 작업 |
| --- | --- |
| 1 | **계약 3종 합의 참여 (3일)** / 유닛 스키마 확정 + ajv 검증기 |
| 1 | 밸런스 에디터(웹 테이블 UI) 제작 |
| 2 | 유닛 18종 수치 1차안 입력 (마스터 §5.1, §6.1 기준) |
| 2 | 스킬 18종을 프리미티브 조합으로 표현 시도 → 표현 불가 항목을 B에게 리스트로 전달 |
| 2 | AI 의사결정 트리 문서 설계 (코드는 M1) |

**M0 DoD**

- [ ]  `npm run validate:balance` 통과하는 유닛 18종 JSON
- [ ]  밸런스 에디터로 수치 수정 → 내보내기 가능
- [ ]  프리미티브 부족 항목 리스트가 B에게 전달됨
- [ ]  AI 상태 전이도 문서 완성

### M1 (4주) — AI 4난이도, 수치 조정

- 1주: AI 골격 (상황 평가 → 상태 → 커맨드). headless 러너로 자가 대전 확인
- 2주: 카운터 테이블, 가중 랜덤, 히스테리시스
- 3주: 4난이도 파라미터 튜닝
- 4주: 스킬 18종 데이터 완성 + 1차 수치 조정
- DoD: AI끼리 1,000판 자동 대전이 돌아가고 승률 리포트가 나옴

### M2 (4주) — 캠페인 24스테이지, 밸런스 1차

- 1주: 자동 대전 시뮬레이터 고도화, 리포트 지표 구축
- 2주: **밸런스 1차 조정** (승률 목표 범위 수렴까지 반복)
- 3주: 캠페인 24스테이지 설계 + 난이도 곡선 검증
- 4주: 연구소 메타 트리, 튜토리얼 문구/도감 텍스트

### M3 (5주) — 밸런스 2차, 베타 운영

- 1~2주: PvP 전용 밸런스 검토 (AI 기준과 사람 기준은 다르다)
- 3주: 클로즈 베타 모집·운영, 피드백 수집 체계
- 4~5주: 베타 데이터 기반 2차 조정, 랭크 모드 메타 격리 검증

---

## 8. 다른 트랙과의 접점

| 상대 | 받는 것 | 주는 것 | 데드라인 |
| --- | --- | --- | --- |
| B 시뮬 | headless 러너, 배치 러너, 프리미티브 10종 | 밸런스 JSON, AI 모듈, 프리미티브 추가 요청 | 러너 M0 종료 |
| A 프론트 | UI 필드 요구사항 | 밸런스 JSON (도감/툴팁용), 텍스트 | M0 종료 |
| D 아트 | — | 유닛 18종 컨셉 설명, 스킬 연출 요구사항 | M0 1주차 |

**금지 사항**: `/sim`, `/render` 코드 직접 수정 금지. 수치가 코드에 박혀 있으면 이슈로 요청.