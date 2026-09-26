# 제품 유닛·인물 보스·전투 음악 제작 인계

## 제작한 것

| 항목 | 결과 | 확인 자료 |
| --- | --- | --- |
| 게임용 캐릭터 | T1~T8은 제품 사진을 살짝 일러스트화하고 전투 표정을 넣은 16종, T9는 제품 없이 이재용·스티브 잡스 캐리커처 보스 2종. 총 444프레임. idle/move/attack/die/cast와 T5 folded/unfolded, T7 deploy 제공 | [게임 아트 시트](previews/unit-art-contact-sheet.png), [사진·애니메이션 비교](previews/photo-animation-gallery.html), [제품 사진 출처](source/product-photos/sources.json), [보스 얼굴 기록](source/boss-portraits/README.md) |
| 콘셉트 | 게임 프레임에서 추출한 세미콘/오차드 각 9종의 라인업 | [세미콘](concepts/semicon-lineup.png), [오차드](concepts/orchard-lineup.png), [제작 기록](concepts/prompts.md) |
| 효과음 | 67개, 원본 WAV + 배포용 OGG/MP3 | [사운드 목록/미리듣기](audio/index.html), [제작 설명](audio/README.md) |
| BGM | 진영별 4트랙, 총 8개. 150 BPM, 16마디/25.6초 전투 전자음악 레이어 루프와 Age 4 전용 트랙 | [오디오 manifest](audio/manifest.json) |
| 통합 데이터 | 캐릭터·오디오 경로를 `assets/manifest.json`에 연결. 이미지 4개 atlas JSON/PNG 제공 | [에셋 manifest](manifest.json) |

## 다시 만들기와 검사

```bash
python3 -m pip install -r assets/tools/requirements-art.txt
python3 assets/tools/generate_unit_art.py --overwrite
python3 assets/tools/make_previews.py
python3 assets/tools/pack_assets.py
python3 assets/tools/validate_assets.py
```

오디오 재생성은 `audio/README.md`의 FFmpeg 준비가 필요하다. 현재 산출물 검사는 18종 444프레임, 아틀라스 4장, 67개 효과음과 8개 BGM의 WAV/OGG/MP3 존재·규격을 통과했다. 이 환경에는 FFmpeg가 없어 인코딩 파일의 실제 디코딩 검사는 건너뛰었다.

## 아직 해야 할 검수

- **A:** 클라이언트 화면에서 128/192px 프레임 크기, trim·앵커·좌우 반전, 공격 이벤트 타이밍, 40기 동시 표시 성능을 확인한다.
- **B:** 스킬 상태·이벤트와 T1 페어, T5 접힘, T8 과열 데이터 필드를 실제 시뮬에 연결한다.
- **C:** `units.json`의 임시 ID 18개를 밸런스 JSON의 ID와 맞춘다. 현재 밸런스 JSON이 없어 교차 검증을 수행할 수 없다.
- **D/팀:** 실제 전투 크기에서 제품·인물 식별성, 팔다리 대비, 스킬 판독성, 사운드 믹스와 루프 반복 피로도를 검수한다. 공개 배포 전 제품 사진 및 보스 얼굴 참조 사진의 재사용 조건을 확인한다.

현 단계는 **게임에서 참조 가능한 새 디자인 초안**이다. 클라이언트 코드가 아직 없어 실제 전투 화면과 오디오 재생기는 팀 통합 때 확인해야 한다.
