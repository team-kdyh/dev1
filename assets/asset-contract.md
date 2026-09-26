# 에셋 계약 초안 · M0

**상태: D 초안. A(렌더), B(시뮬), C(데이터)의 합의 전이다.** 이 문서의 미확정 항목은 실제 팀의 답을 받아 확정한다.

## 현재 구현된 규격

| 항목 | 규격 |
| --- | --- |
| 유닛 키 | `assets/units.json`의 `id` (C 확인 전 임시 ID) |
| 파일명 | `{id}_{state}_{frame:02d}.png` |
| 원본 프레임 | T1~T6 128×128, T7~T9 192×192, 8비트 RGBA PNG |
| 앵커 | 원본 프레임 하단 중앙 `(0.5, 1.0)` |
| 클립 | idle 4, move 6, attack 4, die 6, cast 4. `semicon_t7_workstation`에 deploy 4 추가 |
| 재생 속도 | 기본 12fps, die 15fps (6프레임/0.4초) |
| atlas | 진영과 티어군별 분할, 페이지당 최대 2048×2048, 2px 패딩과 1px 가장자리 확장, trim, JSON Hash + PNG |
| 상태 fallback | stun → idle + 상태 오버레이. 미구현 클립은 idle로 표시하는 방안을 A와 확인할 것 |
| 데이터 연결 | `assets.sprite`에 유닛 ID를 넣고 `assets/manifest.json`에서 atlas와 프레임을 찾는 방안을 C/A와 확인할 것 |
| 오디오 파일 | 44.1kHz, 효과음 모노 0.1~1.5초와 -6dBFS 이하 피크, BGM 스테레오 150 BPM·16마디·25.6초 루프. WAV 원본 + OGG/MP3 배포용 |

`assets/manifest.json`은 `pack:assets`가 생성한다. 각 유닛에는 `anchor`, `clips`(fps, loop, frames, hitFrame)가 있으며 각 프레임 참조에는 `atlas`, `frame`, `source`가 있다. 렌더는 atlas JSON의 `sourceSize`와 `spriteSourceSize`로 trim 전 위치를 복원한다.

`assets/audio/manifest.json`은 사운드 경로와 루프 지점을 제공한다. `pack:assets`는 이를 메인 manifest의 `audioManifest` 및 유닛별 `sfx` 참조에 연결한다. 게임 내 BGM 버스 기본 음량과 MP3 fallback 루프 처리는 A와 확정해야 한다.

### T9 보스 ID 호환성

T9의 현재 화면은 인물형이지만 이미 패킹·오디오 계약에 쓰인 제품형 ID를 유지한다. A·B·C가 옛 ID를 참조한다면 아래 현재 ID로 맞춰야 한다. 원본 게임 명세에 적힌 T9 전투 능력 변경은 이 에셋 작업 범위에 포함되지 않는다.

| 기존 ID | 현재 ID | 화면에 표시할 대상 |
| --- | --- | --- |
| `semicon_t9_chairman` | `semicon_t9_trifold` | 이재용 인물 보스, 제품 이미지 없음 |
| `orchard_t9_founder` | `orchard_t9_imac` | 스티브 잡스 인물 보스, 제품 이미지 없음 |

플레이스홀더 생성물은 `assets/placeholders/units`에만 쓴다. 정식 프레임은 `assets/frames/units`에 같은 파일명으로 놓으며, 패킹 시 정식 프레임을 우선한다. 따라서 플레이스홀더를 다시 생성해도 정식 아트를 덮어쓰지 않는다.

현재 스크립트는 **8비트 RGBA, 비인터레이스 PNG**를 입력으로 받는다. 정식 아트의 내보내기 프리셋도 동일하게 맞춘다. 다른 색상 형식은 검증에서 명시적으로 거부한다.

## A·B·C와 확정할 항목

- [ ] **A:** 실제 렌더러의 JSON Hash 로딩과 trim/앵커 복원, 화면 크기 대비 유닛 픽셀 크기, 좌우 반전 방식, `package.json` 통합.
- [ ] **B:** 시뮬의 정지 상태를 idle로 매핑하는 기준. 공격·명중·스킬·사망·본진 피격·Age 상승·T9 등장 이벤트의 `tick`, `unitId`, `eventId`, `x`, `faction` 제공 여부.
- [ ] **B/A:** `folded/unfolded`, `cooling`, `ghost`, 과열 1~5단계, T1 페어의 두 개체, `stun/silence/slow/malfunction/charm` 표시용 데이터와 우선순위.
- [ ] **C:** 임시 유닛 ID 18개와 `assets.sprite` 논리 ID 방식. 명칭 변경 시 ID를 유지할지 여부.
- [ ] **A:** OGG/MP3 재생 선택, 중복 효과음 제한, BGM 레이어 루프 지점과 페이드 방식.

## 이벤트 소비 원칙

렌더는 시뮬 스냅샷과 이벤트만 읽는다. 애니메이션의 `hitFrame`은 화면 피드백용이며 피해 판정 시점을 바꾸지 않는다. 동일 `eventId`는 재생 중복을 피하기 위한 키로 제안한다.

## 실행 명령

```bash
python3 assets/tools/generate_placeholders.py
python3 assets/tools/pack_assets.py
python3 assets/tools/validate_assets.py
```

Node/npm이 있는 팀 환경에서는 같은 순서로 `npm run generate:placeholders`, `npm run pack:assets`, `npm run validate:assets`를 사용한다. 현재 폴더에는 게임 소스가 없어 인게임 연동 검수는 A의 프로젝트를 연결한 뒤 수행한다.
