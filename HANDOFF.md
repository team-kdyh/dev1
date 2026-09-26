# Track D 아트·사운드 핸드오프

**전달 브랜치:** [`feat/track-d-art-audio-final`](https://github.com/team-kdyh/dev1/tree/feat/track-d-art-audio-final)

**상태:** 이미지·오디오 파일과 manifest 생성 및 독립 검증 완료. A 클라이언트·B 시뮬·C 밸런스 브랜치와의 인게임 통합은 아직 검증하지 않았다.

## 바로 확인하기

| 확인할 것 | 파일 |
| --- | --- |
| 18종 캐릭터 한눈에 보기 | [캐릭터 시트](assets/previews/unit-art-contact-sheet.png) |
| 사진과 동작 비교 | [18종 애니메이션 미리보기](assets/previews/photo-animation-gallery.html) |
| 이미지 파일 전체 | [이미지 갤러리](assets/image-gallery.html) |
| 효과음·BGM 목록 | [사운드 미리듣기](assets/audio/index.html) |
| 제작 내용과 재생성 방법 | [제작 인계](assets/production-handoff.md) |

동적 미리보기는 저장소 루트에서 `python3 -m http.server 8000`을 실행한 뒤 `http://localhost:8000/assets/previews/index.html` 또는 `http://localhost:8000/assets/audio/index.html`을 열면 된다.

## 전달 파일과 연동 계약

| 항목 | 경로와 사용법 |
| --- | --- |
| 유닛 목록 | [`assets/units.json`](assets/units.json): `id`, `faction`, `tier`, `name`. 현재 18개 ID가 이미지·효과음의 연결 키다. |
| 이미지 진입점 | [`assets/manifest.json`](assets/manifest.json): `units[id].clips[state]`에 `fps`, `loop`, `frames`, 공격의 `hitFrame`이 있다. 프레임 참조의 `atlas`와 `frame`으로 아틀라스 JSON을 찾는다. 경로는 `assets/` 기준이다. |
| 이미지 본체 | [`assets/atlases`](assets/atlases): 진영·티어군별 PNG/JSON 4쌍. JSON Hash의 `frame`, `spriteSourceSize`, `sourceSize`로 trim 전 위치를 복원한다. 원본 프레임은 [`assets/frames/units`](assets/frames/units)에 있다. |
| 오디오 진입점 | [`assets/audio/manifest.json`](assets/audio/manifest.json): `sfx[unitId][action]`, `bgm[faction][layer]`에서 OGG/MP3 경로를 고른다. 메인 manifest의 `audioManifest`와 유닛별 `sfx`에도 연결돼 있다. 경로는 `assets/` 기준이다. |

- 원본 프레임은 T1~T6이 128×128, T7~T9가 192×192 RGBA PNG다. 앵커는 하단 중앙 `(0.5, 1.0)`이다.
- 기본 클립은 `idle` 4프레임, `move` 6, `attack` 4, `die` 6, `cast` 4다. 기본 12fps이며 `die`는 15fps다. `semicon_t5_fold`에는 `folded`·`unfolded`, `semicon_t7_workstation`에는 `deploy`가 각각 4프레임 추가된다.
- T9 보스는 화면에 이재용·스티브 잡스 캐리커처만 보인다. 계약 ID는 기존 `semicon_t9_trifold`, `orchard_t9_imac`을 유지했다. `semicon_t9_chairman`, `orchard_t9_founder`를 쓰는 코드가 있다면 ID 매핑을 합의해야 한다.
- 일반 유닛 16종의 눈·입은 제품 위에 직접 그려져 있다. 화면 뒤의 네모 배경은 사용하지 않는다. 이재용 보스의 목과 얼굴도 몸통 중앙에 맞췄다.
- 효과음은 유닛별 54개와 공통 13개로 총 67개다. 전투 BGM은 8개이며 44.1kHz·150BPM·25.6초 루프다. `loopStart`·`loopEnd`는 오디오 manifest의 샘플 프레임 값이다.

## 팀별 남은 연결 작업

- **A / 클라이언트:** 아틀라스 JSON Hash 로딩, trim·앵커 복원, 좌우 반전과 클립 전환을 실제 화면에서 확인한다. OGG 우선·MP3 대체, BGM 레이어 동기화와 효과음 중복 제한을 정한다. `hitFrame: 2`는 0부터 센 공격 3번째 프레임의 화면 피드백용이며 피해 판정 시점을 바꾸지 않는다.
- **B / 시뮬:** 공격·명중·스킬·사망 등 이벤트의 `unitId`, `eventId`, `tick`, `faction`, 좌표를 렌더·오디오에 전달할 방식을 확정한다. T1 페어, T5 접힘, T8 상태와 각 상태이상 표시 우선순위를 연결한다.
- **C / 데이터:** `assets/units.json`의 18개 ID를 밸런스 데이터의 `assets.sprite`와 대조하고, T9 호환 ID와 명칭 변경 정책을 확정한다. 이 브랜치에는 C의 밸런스 JSON이 없어 교차 검증은 아직 수행하지 못했다.
- **D / 팀 리뷰:** 실제 전투 배율에서 제품·인물 식별성, 표정, 스킬 판독성, 40기 동시 표시 성능과 사운드 믹스를 검수한다. 공개 배포 전에 [제품 사진 출처](assets/source/product-photos/sources.json)와 [인물 참조·크레딧](assets/source/boss-portraits/README.md)의 이용 조건을 확인한다.

이 브랜치는 D 산출물을 독립적으로 전달한다. A·C 브랜치에도 루트 `package.json`이 있으므로 병합할 때 스크립트 항목을 합쳐야 한다. 상세 미확정 계약은 [에셋 계약 초안](assets/asset-contract.md)에 있다.

## 검증과 재생성

`python3 assets/tools/validate_assets.py` 결과: **유닛 18종, 원본 프레임 444개, 패킹 프레임 444개, 아틀라스 4장, 효과음 67개, BGM 8개 통과**. FFmpeg가 없는 이 작업 환경에서는 OGG/MP3의 실제 디코딩 검사를 수행하지 못했다. 인게임 렌더·재생 검사는 팀 통합 후 필요하다.

이미지 재생성이 필요하면 [`assets/tools/requirements-art.txt`](assets/tools/requirements-art.txt)의 Pillow를 설치한 뒤 `generate_unit_art.py --overwrite` → `make_previews.py` → `pack_assets.py` → `make_image_gallery.py` → `validate_assets.py` 순서로 실행한다. 오디오 재생성 방법은 [오디오 README](assets/audio/README.md)에 있다.
