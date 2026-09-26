# Track B 핸드오프 — Unity 2D 시뮬레이션 초안

기준일: 2026-09-26 · 브랜치: `feat/track-b-unity-simulation` · 프로젝트 위치: [`UnityProject/`](UnityProject/) (Unity Hub에서 이 폴더를 프로젝트로 열기)

## 한눈에 보는 상태

이 브랜치는 Track B의 **실행 가능한 Unity/C# 프로토타입**이다. 저장소의 다른 트랙에 있는 웹/TypeScript 구현과 아직 연결되지 않았으며, 팀 명세의 공식 `1.0.0` 계약이나 M0 완료 판정을 대체하지 않는다. 로컬 계약 버전은 [`Contracts.cs`](UnityProject/Assets/Scripts/Sim/Contracts.cs)의 `0.5.0-unity-orchard-basic-draft`다.

| 영역 | 현재 상태 |
| --- | --- |
| 기본 대전 | P0 세미콘 9종 / P1 오차드 9종. 생산, 이동, 가장 가까운 적 단일 공격, 상성·방어, 본진 피해·승패 |
| 경제·입력 | 30틱/초, 2틱 선행 명령, 자원 수급, 최대 5칸 FIFO 생산 큐, 인구 예약·취소 환불·쿨다운 |
| 고유 능력 | 워치 메딕의 범위 내 아군 회복만 동작. 상태 데이터 구조는 있으나 나머지 유닛 고유 스킬은 미구현 |
| 검증 도구 | Unity EditMode 테스트, `.NET` 시뮬 검사, 헤드리스 단일/배치 실행, 스냅샷·체크섬 |
| 화면 | `SampleScene`의 임시 Play 화면과 별도 `Tech War → Simulation Sandbox` 에디터 창 |

오차드 유닛은 적 측만, 세미콘 유닛은 플레이어 측만 기본 생산한다. 시뮬레이션도 다른 진영 유닛의 생산 명령을 `WRONG_FACTION`으로 거부한다. 적의 자동 생산은 임시 로직이지 명세의 정식 AI가 아니다.

## 이어받아 실행·검증하기

1. Unity Hub에서 `UnityProject/`를 **Unity 6000.3.2f1**로 연다. 최초 실행 시 패키지 임포트가 끝날 때까지 기다린다.
2. `Assets/Scenes/SampleScene.unity`를 열고 **Play**를 누른다. 아래 T1~T9 버튼으로 세미콘을 생산한다. 오른쪽 오차드는 자동 생산한다. 실행 어댑터는 이 씬에서만 자동 생성된다.
3. Unity **Window → General → Test Runner → EditMode → Run All**로 에디터 테스트를 실행한다. 배치 실행에서도 에디터 창을 확인하는 테스트가 있으므로 `-nographics` 옵션은 사용하지 않는다.
4. `.NET 10 SDK`가 있다면 `UnityProject/`에서 아래 명령을 실행한다. `SimChecks`는 Unity가 최초 실행 때 내려받은 NUnit 패키지를 참조하므로 1번을 먼저 해야 한다.

```powershell
dotnet run --project Tools/SimChecks
dotnet run --project Tools/Headless -- --seed 12345
dotnet run --project Tools/Headless -- --seed 12345 --out result.json
dotnet run --project Tools/Headless -- --batch 10 --out batch.csv
```

헤드리스 결과 파일은 기존 파일을 덮어쓰지 않는다. 배치 CSV는 개별 경기 결과이며 명세의 진영별 승률·유닛 픽률 리포트는 아직 제공하지 않는다. 자세한 조작법과 데이터 계약은 [`UnityProject/README.md`](UnityProject/README.md)를 참고한다.

## 소스 위치와 변경 시 주의점

- [`Assets/Scripts/Sim`](UnityProject/Assets/Scripts/Sim): Unity API에 의존하지 않는 시뮬레이션 코어. `Simulation.cs`가 틱·입력·전투, `Contracts.cs`가 명령·스냅샷, `Effects.cs`가 상태 데이터, `Fixed.cs`/`Rng.cs`가 결정론 보조 코드다.
- [`M0Balance.cs`](UnityProject/Assets/Scripts/Sim/M0Balance.cs): 18종 이름·스탯·상성·진영별 표시 순서. **사용자가 직접 고친 체력·공격력·가격·사거리 등은 의도된 밸런스 변경으로 보고 되돌리지 않는다.** 기존 3종 ID를 유지했으므로 데이터 배열 순서와 화면 티어 순서는 다르다. 이름을 찾아 수치를 수정한다.
- [`Assets/Scripts/Play`](UnityProject/Assets/Scripts/Play): SampleScene용 임시 UI·적 자동 생산. [`Assets/Editor/TechWar`](UnityProject/Assets/Editor/TechWar)는 독립적인 에디터 샌드박스다.
- [`Assets/Tests/Editor`](UnityProject/Assets/Tests/Editor)와 [`Tools`](UnityProject/Tools): 테스트·헤드리스 진입점. `Library/`, `Temp/`, 빌드 산출물은 Git에서 제외한다.

코어 사용 시 `TickInput.Tick`은 **적용할 틱**이다. 호출자가 `simulation.Tick + Simulation.InputDelay`(현재 2) 이상으로 예약하며 코어가 추가로 2틱을 더하지 않는다. `Step()`이 정확히 1틱을 처리한다. 스냅샷은 내부 상태와 분리된 복사본이고 `Events`는 직전 처리 틱의 이벤트다. 잘못된 입력 형식은 예외, 자원·쿨다운·진영 같은 게임 규칙 위반은 `rejected` 이벤트로 처리한다.

## 팀 통합 전 합의가 필요한 차이

1. **런타임/계약:** Track B 원본 명세는 Node/브라우저에서 쓰는 TypeScript `contracts.ts`와 JSON 밸런스 데이터를 요구한다. 현재는 Unity용 C# 어셈블리, `UnitId` enum, `M0Balance.cs` 하드코딩 데이터다. 이 브랜치를 공식 계약으로 간주하거나 다른 트랙 구현에 직접 연결하지 말고, A·C 담당과 포팅 또는 어댑터 방향 및 버전 상승을 합의해야 한다.
2. **틱·스키마:** 현재 타이머는 정수 틱, 좌표·HP·캐시는 ×1000 정수로 보관한다. 명세의 초 단위 필드·문자열 유닛 ID·스냅샷 필드와 완전히 같지 않다. 입력 지연과 이벤트 시점도 통합 계약에서 확정해야 한다.
3. **미구현 범위:** 워치 메딕 외 17종의 고유 스킬/공통 이펙트 실행, 상태이상 적용, 시대 해금·업그레이드·전략 스킬·본진 포탑, JSON 검증/로드, 완전 상태 저장·복원, 정식 리플레이, 서버/PvP, 정식 아트/UI는 남아 있다. 현재 헤드리스 배치와 적 자동 생산은 정식 AI·밸런스 리포트가 아니다.
4. **다음 검증:** 팀 계약을 확정한 뒤 명세의 동일 시드·동일 커맨드 장시간 결정론 감사와 다른 런타임 간 비교를 추가한다. 현 체크섬은 로컬 상태 비교용이며 암호학적 서명이 아니다.

권장 인계 순서는 **공식 계약/데이터 소유권 합의 → A·C와 연결 방식 결정 → 남은 스킬·게임 규칙 구현 → 장시간 결정론/리플레이·네트워크 검증**이다. 현재 구현을 그대로 팀의 M0/M1 완료로 표시하지 않는다.
