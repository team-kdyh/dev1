# TECH WAR — Unity 세미콘 vs 오차드 기본 전투

이 폴더(`UnityProject`)가 Unity 프로젝트 루트입니다. Unity Hub에서 이 폴더를 열어주세요. 사용한 에디터는 `6000.3.2f1`입니다.

이 브랜치는 Track B의 Unity 2D 프로토타입입니다. 저장소의 다른 트랙에 있는 웹/TypeScript 구현과는 아직 연결되지 않았습니다.

## Unity에서 실행

1. `Assets/Scenes/SampleScene.unity`를 열고 컴파일이 끝날 때까지 기다립니다.
2. Unity 상단의 **▶ Play**를 누릅니다. **Game** 탭에서 대전이 자동 시작됩니다.
3. 아래 **T1~T9 세미콘 생산 버튼**으로 유닛을 생산합니다. 오른쪽 적은 오차드 유닛만 자동 생산합니다.
4. **일시정지**, **다시 시작**, **항복**, 생산 대기의 **취소** 버튼을 사용할 수 있습니다.

도형은 임시 유닛, 초록색 막대는 체력입니다. 본진 파괴 또는 480초 제한시간에 종료합니다. 런타임 어댑터가 SampleScene의 Play 시작 때 생성되므로 스크립트를 직접 드래그해 붙일 필요가 없습니다. 다른 씬에는 자동 생성하지 않습니다.

기존 **Tech War → Simulation Sandbox** 메뉴도 사용할 수 있습니다. 이 별도 백엔드 테스트 창에서는 왼쪽 세미콘·오른쪽 오차드의 수동 생산과 1틱 진행/배속 검사가 가능합니다. Game 화면과 테스트 창은 각각 독립된 대전입니다.

## 유닛 스탯 수정

`Assets/Scripts/Sim/M0Balance.cs`의 이름별 `new UnitStats(...)`에서 `hp`(체력), `attack`(공격력), `armor`(방어력), `range`(공격 사거리), `speed`(이동속도), `cost`(가격), `supply`(인구)를 수정합니다. `productionTicks`는 생산시간/재생산 쿨다운, `attackTicks`는 공격 간격이며 **30틱 = 1초**입니다. Play를 종료한 상태에서 수정한 후 다시 실행하세요. 별도 스탯 편집 창은 추가하지 않았습니다.

화면 순서는 **버즈 트윈스 → 워치 메딕 → A폰 보병 → S폰 저격수 → 폴드 방패병 → 탭 포병 → 북 워크스테이션 → AI 어시스턴트 → 회장**입니다. 기존 3종의 ID를 유지하기 위해 파일의 데이터 배열은 화면 순서와 다릅니다. 배열 위치를 바꾸지 말고 유닛 이름을 찾아 수치만 수정하세요.

기존 버즈/A폰/탭 수치는 유지했습니다. 특히 탭 포병은 기존 가격 260이며, 전체 명세의 380으로 자동 변경하지 않았습니다. 추가 6종은 명세의 체력·공격력·사거리·이동속도·가격·인구를 사용하고, 명세에 없는 시간·방어 분류는 임시값입니다. 폴드의 공격속도 0.8회/초는 정수 틱 38로 근사합니다. 사용자 밸런스 변경은 의도된 것으로 취급하며 이전 값으로 자동 복구하지 않습니다.

이번 단계에서는 두 진영 18종 모두 **기본 이동 + 가장 가까운 적에게 단일 공격**을 합니다. 워치 메딕은 추가로 30틱마다 사거리 100 안에서 체력 비율이 낮은 부상 아군을 최대 3명까지 6씩 회복합니다. 실제 회복량은 최대 체력을 넘지 않습니다. 회복 수치는 `M0Balance.cs`의 `MedicHeal...` 상수에서 조정할 수 있습니다. 광역/관통, 저격 우선 타겟팅, 접힘/펼침, 설치 고정, 버프, 소환, 쌍둥이 스폰과 오차드 고유 스킬은 아직 없습니다. 시대 해금도 없으므로 자원·인구·큐·쿨다운 조건만 맞으면 T9까지 생산할 수 있습니다. 시작 자금은 여전히 300이라 비싼 유닛은 자금을 모아야 합니다.

## 검증 / 화면 없는 실행

Unity: **Window → General → Test Runner → EditMode → Run All**.

프로젝트 루트에서 .NET 10 SDK로:

```powershell
dotnet run --project Tools/SimChecks
dotnet run --project Tools/Headless -- --seed 12345
dotnet run --project Tools/Headless -- --seed 12345 --out result.json
dotnet run --project Tools/Headless -- --batch 10 --out batch.csv
```

`SimChecks`는 Unity가 내려받은 NUnit DLL을 사용하여 동일한 동기 테스트 메서드를 실행합니다. Unity 프로젝트를 최초 1회 열어 패키지가 준비되어 있어야 합니다. `Headless`는 외부 패키지나 Unity 설치에 의존하지 않습니다. 출력 파일이 이미 있으면 덮어쓰지 않고 오류로 종료합니다. 배치는 판별 결과 CSV이며, 진영별 승률/픽률 집계와 실제 난이도 AI는 후속 작업입니다.

## 현재 구현 범위와 계약

- `Assets/Scripts/Sim`: Unity 의존성 없는 순수 C# 어셈블리. 30틱, 자원, FIFO 생산 큐, 인구 예약, 이동, 단일 타격, 워치 메딕 회복, 공통 상태 저장 구조, 처치 보상, 승패, 스냅샷, 체크섬.
- `Assets/Editor/TechWar`: 스냅샷을 그리는 EditorWindow. 에디터 시간은 이 어댑터에서만 읽습니다.
- `Assets/Scripts/Play`: Play 버튼용 MonoBehaviour와 임시 Game 화면. 프레임 시간을 30틱 시뮬레이션으로 전달합니다. 기본 IMGUI를 사용해 추가 UI 패키지 설정이 필요 없습니다.
- `Assets/Tests/Editor`: Unity EditMode 테스트.
- `M0Balance.cs`: 세미콘 9종과 오차드 9종의 이름·티어·스탯·기본 공격 타입과 상성표. 고유 스킬을 제외한 기본 전투용 데이터입니다.

```csharp
var simulation = new TechWar.Sim.Simulation(seed: 12345);
simulation.PushCommand(new TechWar.Sim.TickInput(
    simulation.Tick + TechWar.Sim.Simulation.InputDelay, 0,
    new TechWar.Sim.SpawnUnitCommand(TechWar.Sim.UnitId.Bud)));
simulation.Step(); // 정확히 1틱. 렌더/시계와 무관.
var view = simulation.GetSnapshot();
```

`TickInput.Tick`은 **적용할 틱**입니다. 호출자가 `현재 Tick + 2` 이상으로 예약하고 시뮬은 추가로 2틱을 더하지 않습니다. 한 플레이어의 같은 틱 커맨드는 제출 순서를 유지하며, 양측 사이에서는 틱→playerId 순서를 고정합니다. 스냅샷 Tick은 완료한 틱 수이며 Events는 직전 처리 틱의 이벤트입니다.

기본 대전은 **P0 세미콘 / P1 오차드**입니다. 생산 명령은 시뮬레이션에서 진영을 검사하며, 다른 진영 유닛을 요청하면 캐시·인구·큐를 바꾸지 않고 `WRONG_FACTION` 이벤트를 냅니다. 세미콘 미러전처럼 별도 테스트가 필요하면 `Simulation` 생성 시 `player1Faction`을 명시합니다.

입력의 잘못된 playerId/예약 틱/지원하지 않는 커맨드는 호출 경계에서 예외가 납니다. 게임 규칙 위반(캐시·쿨다운·인구·큐 초과 등)은 상태를 바꾸지 않고 rejected 이벤트를 냅니다. 종료 이후 Step은 아무 작업도 하지 않으며 마지막 결과 스냅샷이 유지됩니다.

좌표·HP·캐시는 ×1000 정수이며 곱셈/나눗셈의 중간 계산은 64비트입니다. 초당 이동·수급은 나머지를 이월해 절삭 누적을 방지합니다. **시간은 정수 틱 수**로 저장합니다. 명세의 ×1000초 저장 대신 1/30초를 정확히 표현하기 위한 Unity M0 결정입니다. 스냅샷에서만 일반 단위/초로 변환합니다.

생산 큐는 최대 5개, 필드와 큐를 합쳐 인구 12를 예약합니다. 예약 시 비용을 차감하고 취소 시 80%를 환불합니다. 생산시간과 유닛별 재예약 쿨다운은 동일한 `productionTicks` 값을 사용합니다. 출구에 유닛이 있으면 진영과 관계없이 생산 완료 상태로 기다립니다. 처치 보상은 적 비용의 40%입니다.

화면에서 취소할 때는 `CancelQueueCommand(index, snapshot.Players[player].QueueRevision)`으로 큐 버전을 함께 보냅니다. 예약된 2틱 사이에 큐가 변했다면 `QUEUE_CHANGED`로 거부하고 다시 선택하게 하여 다른 유닛의 오취소를 방지합니다. 버전을 생략한 스크립트 명령은 실행 시점의 index를 뜻합니다. 본진 파괴 판정은 틱의 공격 단계가 끝난 뒤이며, 같은 틱에 양측이 파괴되면 무승부입니다.

스냅샷은 내부 상태와 분리된 깊은 복사본입니다. FNV-1a는 정해진 little-endian 직렬화 순서로 PRNG, 플레이어, 큐, 예약 입력, 유닛, 타이머 등 미래 결과에 영향을 주는 상태를 포함합니다. 이벤트/렌더용 값은 해시 입력에서 제외합니다. 이 체크섬은 치트 방지용 암호학적 서명이 아닙니다.

`0.5.0-unity-orchard-basic-draft`는 로컬 C# 초안입니다. 기존 명세의 공식 `1.0.0` 계약을 팀 합의 없이 대체한 것으로 취급하면 안 됩니다. 특히 틱 의미, 타이머 단위, 임시 enum 유닛 ID와 JSON 스키마는 프론트/콘텐츠 담당과 통합 전에 확정해야 합니다.

아직 구현하지 않은 것: 워치 메딕 이외의 고유 스킬, 본진 포탑, 시대·업그레이드, JSON 검증/로드, 완전 상태 저장·복원, 정식 리플레이, 서버/PvP, 정식 아트/UI. RNG가 준비되어 있지만 현재 기본 전투는 확률 요소가 없으므로 seed만 바꿔도 전투가 무작위로 변하지 않습니다. CLI 스크립트는 seed로 생산 순서를 바꿉니다.

참고: [Unity EditorWindow.Update](https://docs.unity.com/en-us/engine/6000.0/script-reference/unityeditor/editorwindow/update), [Unity 테스트 어셈블리](https://docs.unity.com/en-us/engine/6000.0/manual/packages-list/cus-pkg-development/cus-tests).
