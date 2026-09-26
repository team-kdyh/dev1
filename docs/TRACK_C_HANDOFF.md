# Track C Handoff — 밸런스 · AI · 콘텐츠

작성일: 2026-09-26
대상 브랜치: `feat/track-c-implementation`
기준 브랜치: `gjtjw/track-c-docs`

## 1. 인계 요약

트랙 C가 단독으로 구현할 수 있는 밸런스 데이터, 데이터 검증기, PvE AI 순수 로직, 캠페인/연구 데이터, 밸런스 편집기, 배치 리포트 기반을 구현했다.

현재 코드는 트랙 B의 실제 시뮬레이션 없이도 설치, 타입 검사, 데이터 검증, 단위 테스트, 편집기 빌드까지 수행할 수 있다. 실제 경기 결과를 사용하는 1,000판/10,000판 밸런싱은 트랙 B의 권위 있는 headless 러너가 연결된 후 진행해야 한다.

## 2. 현재 완료 범위

- 세미콘 9종, 오차드 9종 총 18종 유닛 데이터
- 명세에 등장하는 패시브·액티브를 분리한 스킬 데이터 29개
- 시대 4단계, 인게임 업그레이드 6종, 전략 스킬 4종
- 피해 타입 및 방어 타입 상성표
- Easy/Normal/Hard/Expert AI 난이도 데이터
- 진영별 12개, 총 24개 캠페인 스테이지
- 양 진영 연구소 트리 및 랭크 메타 비활성 정책
- JSON Schema 12종과 교차 참조 검증
- 상황 평가, 상태 전이, 행동 점수화, 난이도 노이즈, 결정론적 선택으로 구성된 AI
- 웹 기반 유닛 밸런스 편집기
- headless 어댑터 기반 배치 실행 및 CSV/JSON 리포트
- CI 검증 워크플로

## 3. 아직 완료로 간주하면 안 되는 범위

다음 항목은 외부 트랙 의존성 때문에 구현 또는 실전 검증이 남아 있다.

1. 트랙 B의 `SimulationSnapshot`, `Command`, RNG 계약 승인
2. 트랙 B의 실제 headless 러너 연결
3. 스킬 트리거·조건·대상 선택자의 시뮬레이션 실행 검증
4. 트랙 D의 실제 에셋 매니페스트 연결
5. 권위 있는 1,000판 기준선과 10,000판 릴리스 검증
6. 트랙 A의 도감·툴팁·HUD 데이터 소비 연동

현재 배치 도구의 `smoke` 어댑터는 리포트 파이프라인 점검 전용이다. 해당 결과를 밸런스 근거로 사용하면 안 된다.

## 4. 빠른 시작

요구 환경:

- Node.js 24
- npm 11 이상 권장

```bash
npm ci
npm run check
```

`npm run check`는 다음 작업을 순서대로 수행한다.

1. 밸런스 데이터 검증
2. TypeScript 타입 검사
3. 단위 테스트
4. 밸런스 편집기 프로덕션 빌드

밸런스 편집기 실행:

```bash
npm run editor
```

비권위 배치 파이프라인 점검:

```bash
npm run batch -- --adapter smoke --n 20 --seed 1000 --out reports/smoke.csv
```

기본 어댑터인 `project`는 트랙 B 러너가 연결되기 전까지 의도적으로 실패한다.

## 5. 마지막 검증 상태

인계 직전 다음 결과를 확인했다.

- 데이터 파일 15개: 오류 0개
- 경고 1개: 실제 에셋이 아닌 플레이스홀더 매니페스트 사용
- 테스트 파일 7개, 테스트 13개 통과
- TypeScript 타입 검사 통과
- Vite 프로덕션 빌드 통과
- npm audit 취약점 0개
- 비권위 스모크 배치 200판 완료

에셋 경고는 현재 예상된 상태다. 트랙 D의 실제 매니페스트를 받으면 `src/data/assets.manifest.json`의 키를 교체하고 `placeholder`를 `false`로 바꾼다.

## 6. 핵심 디렉토리

```text
src/
  ai/                         PvE AI 순수 로직과 테스트
  data/
    balance/                  유닛, 스킬, 경제, AI 난이도 데이터
    campaign/stages.json      캠페인 24개
    meta/research_tree.json   연구소와 대전 모드 정책
    schema/                   JSON Schema
tools/
  balance-validator/          AJV 및 교차 검증
  balance-editor/             유닛 밸런스 웹 편집기
  batch/                      headless 어댑터와 리포트
docs/
  contract-decisions.md       팀 승인 전 잠정 계약 10개
  skill-feasibility-audit.md  스킬별 B 연동 요구사항
  pm-checklist.md             진행 상태와 블로커
```

## 7. 데이터 버전과 잠정값

현재 버전:

- `schemaVersion`: `1.0.0`
- `balanceVersion`: `0.1.0-draft`

마스터 명세에 명시되지 않은 다음 수치는 1차 밸런스 잠정값이다.

- 유닛별 공격속도
- 유닛별 방어력
- 일부 생산 쿨다운
- 광역 반경과 일부 최소 사거리
- AI 행동 점수와 여유 캐시 기준

이 값은 실제 headless 대전 데이터 없이 확정하면 안 된다. 수정 시 한 번에 한 계수군만 변경하고, 변경 전후 배치 리포트를 남긴다.

구조가 바뀌면 `schemaVersion`, 수치만 바뀌면 `balanceVersion`을 올린다.

## 8. AI 동작 계약

AI 처리 흐름:

```text
SimulationSnapshot
  → buildContext
  → transitionState
  → enumerateLegalActions
  → scoreActions
  → applyDifficultyPolicy
  → selectWeightedAction
  → Command 또는 no-op
```

주요 규칙:

- AI는 사람과 같은 Command만 생성한다.
- 스냅샷을 직접 변경하지 않는다.
- 합법 행동을 먼저 필터링하므로 의도적 실수도 무효 커맨드를 만들면 안 된다.
- 상황 평가는 기본 15틱 간격이다.
- 전략 상태 변경 후 90틱 동안 재전환을 막는다.
- 모든 무작위 선택은 주입된 `RandomSource`를 사용한다.
- 노멀 AI는 PvP 이탈자 대리 조작에 재사용할 수 있도록 렌더러와 분리되어 있다.

현재 포함된 `XorShift32`는 독립 테스트와 스모크용이다. 실제 게임에서는 트랙 B가 합의한 시드 스트림을 주입해야 한다.

## 9. 트랙 B 연동 방법

### 9.1 배치 러너

`tools/batch/types.ts`의 `HeadlessAdapter`를 구현한다.

```ts
interface HeadlessAdapter {
  readonly id: string;
  readonly authoritative: boolean;
  runMatch(request: MatchRequest): Promise<MatchResult>;
}
```

어댑터 모듈은 다음 중 하나를 내보내면 된다.

```ts
export function createAdapter(): HeadlessAdapter;
// 또는
export default adapter;
```

실행 예시:

```bash
npm run batch -- \
  --adapter ./path/to/headless-adapter.ts \
  --n 1000 \
  --p0 semicon \
  --p1 orchard \
  --ai normal \
  --seed 1000 \
  --out reports/baseline.csv
```

권위 있는 어댑터는 반드시 `authoritative: true`를 반환해야 한다.

### 9.2 AI 연결

매 틱 `evaluateAi`를 호출하되, 반환된 커맨드가 있을 때만 사람 입력과 동일한 커맨드 큐에 넣는다.

필요 입력:

- 읽기 전용 플레이어/유닛 스냅샷
- 현재 틱과 tick rate
- 진영별 해금 유닛과 쿨다운
- 생산 큐, 자원, 인구, 시대, 업그레이드 정보
- 결정론적 RNG

AI가 생성한 커맨드도 사람 커맨드와 같은 유효성 검사를 통과해야 한다.

### 9.3 스킬 실행

`docs/skill-feasibility-audit.md`에 스킬별 요구 기능을 기록했다. 효과 프리미티브를 계속 늘리기보다 아래 세 계층을 공통 계약으로 구현하는 것이 권장안이다.

1. Trigger
2. Condition 및 Target Selector
3. Effect Primitive

특히 파트너 사망, 정지 시간, 공격/처치 횟수, 후방 보호, 환영 어그로, 임시 소유권 변경은 먼저 통합 테스트가 필요하다.

## 10. 트랙 A 연동 방법

- 도감과 툴팁은 `src/data/balance/units`와 `skills`를 ID로 결합해 표시한다.
- 유닛의 `assets`는 실제 경로가 아니라 에셋 논리 키다.
- `roles`는 AI 분석용이지만 도감의 역할 태그로도 사용할 수 있다.
- 에디터가 내보낸 JSON은 검증 후 원본 데이터에 반영한다.
- 랭크 모드에서는 `researchForMatch` 결과가 빈 배열인지 시작 스냅샷에서 재확인한다.

## 11. 트랙 D 연동 방법

`src/data/assets.manifest.json`의 키 이름을 기준으로 실제 에셋을 매핑한다.

필수 범위:

- 유닛 스프라이트 18개
- 공격/사망 SFX 논리 키
- 양 진영 Age 1~4 본진 스프라이트

키 이름을 변경할 경우 유닛 JSON과 매니페스트를 같은 PR에서 변경해야 한다. `npm run validate:balance`가 누락 참조를 검출한다.

## 12. 팀 승인이 필요한 잠정 결정

`docs/contract-decisions.md`의 C-DEC-01~10을 승인하거나 수정해야 한다. 특히 다음 네 항목은 B 연동 전에 반드시 고정한다.

1. 스킬 별도 파일과 ID 참조 방식
2. `light/heavy/structure` 방어 타입
3. AI 판단 주기와 반응 지연의 의미
4. RNG 공용 스트림 또는 AI 전용 파생 스트림

익스퍼트 자원 효율은 현재 담당 명세를 따라 95%다. 마스터 명세의 100%와 다르므로 팀 결정이 필요하다.

## 13. 권장 다음 작업 순서

1. C-DEC-01~10 팀 승인
2. 트랙 B Snapshot/Command/RNG 타입 매핑
3. 실제 headless 어댑터 연결
4. 실제 러너로 20판 스모크 실행
5. 모든 유닛과 스킬의 최소 1회 발동 커버리지 확인
6. 노멀 AI 1,000판 기준선 생성
7. 트랙 D 에셋 매니페스트 교체
8. 트랙 A 도감/툴팁 연동
9. 데이터 변경 PR의 권위 있는 200판 CI 추가
10. M2 릴리스 후보에서 10,000판 검증

## 14. 밸런스 승인 기준

- 크로스 진영 승률: 45~55%
- 미러전 좌우 승률: 47~53%
- 평균 경기 길이: 4~8분
- 모든 유닛 픽률: 3% 초과
- Age 2 평균 진입: 60~90초
- Age 3 평균 진입: 150~210초
- 하드 AI 상대 단일 유닛 스팸 승률: 40% 미만
- 무효 커맨드와 최대 틱 초과: 0건

200판 결과는 경고용이며 최종 승인 근거가 아니다. 큰 방향은 1,000판, 릴리스 승인은 10,000판 결과로 판단한다.

## 15. 인계받는 사람의 첫 확인 체크리스트

- [ ] `npm ci` 성공
- [ ] `npm run check` 성공
- [ ] 플레이스홀더 에셋 경고 외 오류 없음
- [ ] `npm run editor`에서 18종 유닛이 티어별로 표시됨
- [ ] `--adapter smoke` 결과가 `NON_AUTHORITATIVE`로 표시됨
- [ ] `contract-decisions.md` 검토
- [ ] `skill-feasibility-audit.md`를 트랙 B와 검토
- [ ] 실제 headless 어댑터 담당자와 전달 일정 확정

## 16. 관련 문서

- `implementation-plan.md`: 전체 구현계획
- `docs/contract-decisions.md`: 잠정 계약과 승인 대상
- `docs/skill-feasibility-audit.md`: 스킬별 시뮬레이션 요구사항
- `docs/pm-checklist.md`: 완료 상태와 블로커
- `README.md`: 명령어 요약
