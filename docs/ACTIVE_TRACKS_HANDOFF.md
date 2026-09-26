# Active 트랙 통합 핸드오프

기준일: 2026-09-26

작업 브랜치: `integration/active-tracks-character-polish`

## 결과

`feat/track-a-client`, `feat/track-b-unity-simulation`, `feat/track-c-implementation`, `feat/track-d-art-audio-final`의 이력을 모두 포함하며, A 웹 클라이언트가 C의 밸런스 데이터와 D의 캐릭터 아틀라스를 실제로 사용하도록 연결했다.

- 세미콘·오차드 각 9종, 총 18종이 C의 비용·체력·DPS·사거리·속도·설명·역할·스킬명을 사용한다.
- 전투 유닛은 D의 상태별 `idle`, `move`, `attack`, `die`, `deploy`, `cast` 프레임을 PixiJS `AnimatedSprite`로 재생한다.
- 유닛 버튼, 생산 큐, 도감도 전투와 동일한 캐릭터 첫 프레임을 사용한다.
- C와 D에서 이름이 다른 8개 ID는 `src/data/assetMap.ts` 한 곳에서 명시적으로 연결한다.
- 캐릭터 로딩 실패 시 기존 도형 텍스처로 대체되어 게임 부팅은 유지된다.
- 공격 이벤트마다 비순환 attack/cast 클립을 다시 시작하며 피격 시 밀림, 방어 성공 시 방패 링과 방어 자세를 재생한다.
- 원거리 피해는 투사체가 도착한 시점에 적용되며 탄환·에너지 펄스·포탄·강화 스킬탄을 구분한다.
- D의 유닛별 공격·스킬·사망 SFX와 시대별 레이어 BGM을 `AudioDirector`로 연결했다.
- 탱커 전용 방패 돌진 동작을 보강하고 원거리 11종의 사거리를 약 15% 줄였으며, 중앙 전투를 가리던 생산 대기열 HUD를 제거했다.

## 주요 진입점

| 파일 | 역할 |
| --- | --- |
| `src/data/balanceData.ts` | C JSON을 웹 `BalanceData`로 변환 |
| `src/data/assetMap.ts` | C 게임플레이 ID ↔ D 에셋 ID 매핑 |
| `src/render/unitAssets.ts` | 4개 아틀라스 로딩, 상태별 클립·도감 프레임 제공 |
| `src/render/UnitView.ts` | 스냅샷 상태를 실제 캐릭터 애니메이션으로 표현 |
| `src/adapter/combatRules.ts` | 원거리 분류, 투사체 종류, 방어 확률 정의 |
| `src/audio/AudioDirector.ts` | 시뮬 이벤트를 D의 OGG SFX/BGM에 연결 |
| `src/screens/Codex.ts` | 캐릭터 프리뷰와 C의 설명·역할·스킬 표시 |
| `src/data/integratedData.test.ts` | 18종 데이터·ID·프레임 교차 검증 |

## 검증

```bash
npm ci
npm run check
python assets/tools/validate_assets.py
```

- `npm run check`: 밸런스 검증 경고·오류 0, TypeScript 검사 통과, 테스트 10파일 21개 통과, 클라이언트와 에디터 빌드 통과.
- 에셋 정적 검사: 18유닛, 원본/패킹 444프레임, 4아틀라스, 67 SFX, 8 BGM 통과.
- 빌드 결과에 4개 아틀라스 PNG가 모두 포함됨을 확인했다.
- 현재 Windows 환경의 `ffmpeg.exe`는 실제 FFmpeg가 아닌 Python 동명 패키지여서 OGG/MP3 디코딩 검사는 PATH에서 제외하고 실행했다. 파일 헤더·WAV·크기·매니페스트 검증은 수행됐다.
- 연결된 브라우저가 없어 자동 실플레이 캡처는 수행하지 못했다.

## 다음 작업

1. A의 `FakeSimAdapter`와 B의 Unity/C# 시뮬레이션 사이의 배포 방식을 결정한다. 두 트랙은 실행 환경이 달라 이번 브랜치에서는 코드를 억지로 결합하지 않았다.
2. C에 정의된 스킬별 고유 판정을 B 시뮬레이션 또는 최종 웹 어댑터에서 구현한다. 현재는 4번째 공격의 강화 피해·cast 연출·스킬 SFX까지 연결되어 있다.
3. 브라우저에서 캐릭터 크기, 투사체 궤적, 방어 빈도와 SFX/BGM 믹스를 한 차례 수동 확인한다.

세부 병합 기록과 원본 커밋은 [INTEGRATION.md](INTEGRATION.md)를 참고한다.
