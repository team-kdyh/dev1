# 제품 유닛·인물 보스 제작 기록

18종 게임용 캐릭터는 `assets/tools/generate_unit_art.py`에서 만든다. T1~T8은 [제품 사진 원본](../source/product-photos/sources.json)의 배경을 제거하고 채도·명암·색 단계를 조금 조정한 뒤 얇은 윤곽선, 팔다리와 전투 표정을 붙인다. 제품 형태별 얼굴 위치는 코드의 `FACE_PLACEMENTS`에 기록했다. 표정은 별도 네모 바탕 없이 제품 표면에 직접 그리며 눈썹·입의 밝은 외곽선으로 대비를 준다. idle의 위아래 움직임, 이동의 발걸음, 공격·스킬의 더 크게 외치는 입과 팔 동작, 사망의 X자 눈과 기울기를 프레임에 넣었다. T9는 제품 없이 [캐리커처 얼굴과 생성 프롬프트](../source/boss-portraits/README.md), 그린 몸을 쓴다.

T9 프레임에는 제품 사진이 없다. `semicon_t9_trifold`와 `orchard_t9_imac`은 팀 계약을 위한 기존 ID로 유지하지만 화면에는 각각 이재용·스티브 잡스만 보인다. 참조 자료는 [`model-references.md`](../model-references.md)에 있다.

`assets/tools/make_previews.py`는 실제 게임용 idle 프레임에서 `semicon-lineup.png`와 `orchard-lineup.png`를 만든다. 이 라인업과 `assets/image-gallery.html`은 그림 확인용이며, 게임에는 `assets/manifest.json`의 아틀라스 프레임을 사용한다.
