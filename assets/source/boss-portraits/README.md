# T9 보스 얼굴 원본과 생성 기록

두 보스의 얼굴은 아래 참조 사진을 바탕으로 `imagegen` 기본 내장 도구에서 투명한 2D 캐리커처로 만들었다. 보스의 정장·검은 상의·팔다리는 `assets/tools/generate_unit_art.py`에서 그리고, 보스 프레임에는 제품 이미지를 사용하지 않는다.

| 보스 | 참조 사진 | 촬영자·라이선스 | 투명 얼굴 에셋 |
| --- | --- | --- | --- |
| 이재용 / Galaxy Z TriFold | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:%EC%9D%B4%EC%9E%AC%EC%9A%A9%EC%82%BC%EC%84%B1%EC%B4%9D%EC%88%98.jpg) | LEEJAEY68 · CC BY-SA 3.0 | `lee_jae_yong_head.png` |
| 스티브 잡스 / iMac M4 | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Steve_Jobs_Headshot_2010.JPG) | Matthew Yohe · CC BY-SA 3.0 | `steve_jobs_head.png` |

생성 프롬프트:

- **이재용:** “Use case: style-transfer / identity-preserve. Asset type: transparent head for a humorous 2D strategy-game final boss. Input image 1 is the real identity reference photo of Lee Jae-yong. Input image 2 is the current transparent head asset to EDIT. Exaggerate the current asset into a clearly recognizable caricature, with a slightly oversized swept dark hairstyle, stronger angular eyebrows, emphasized thin rectangular glasses and cheeks, and a fierce determined battle expression with a small clenched-teeth grin. Flat 2D cel-shaded illustration with 3-4 color planes and a bold clean dark outline; readable at 65 px height. Keep the face front-facing and preserve the identity and black side-parted hair from the reference. ONLY head and short neck. Genuinely transparent background and alpha, no body, no suit, no products, no weapons, no text, no logos, no other people.”
- **스티브 잡스:** “Use case: style-transfer / identity-preserve. Asset type: transparent head for a humorous 2D strategy-game final boss. Input image 1 is the real identity reference photo of Steve Jobs. Input image 2 is the current transparent head asset to EDIT. Exaggerate the current asset into a clearly recognizable caricature, with a more prominent high bald forehead, round rimless glasses, long distinctive nose, stronger gray stubble beard, and a fierce determined battle expression with a wry clenched-teeth grin and angled eyebrows. Flat 2D cel-shaded illustration with 3-4 color planes and a bold clean dark outline; readable at 65 px height. Keep the face front-facing and preserve the identity, balding gray hair, and glasses from the reference. ONLY head and short neck. Genuinely transparent background and alpha, no body, no turtleneck, no products, no weapons, no text, no logos, no other people.”

이재용 얼굴의 목 중심을 다시 맞출 때는 기존 투명 얼굴 PNG를 편집 대상으로 사용했다. 최종 수정 프롬프트:

> Use case: identity-preserve. Asset type: transparent 2D strategy-game boss head cutout. Image 1 is the existing Lee Jae-yong caricature to EDIT. Change only the short neck below the jaw: it currently leans slightly toward the viewer's right. Straighten the neck so it is upright and centered directly under the chin and face, with balanced left and right contours. Keep the face, hairstyle, glasses, fierce eyebrows, grin, colors, shading, linework, head orientation and overall crop unchanged. Preserve recognizability and the existing caricature style. No body, shoulders, clothing, products, text, logos, other people, or background. Keep genuine transparent alpha around the head and neck.

프레임 생성기는 두 얼굴 PNG의 거의 투명한 가장자리 픽셀을 자르기 범위에서 제외해 목과 몸통을 중앙 정렬한다.

참조 사진과 그 변형물의 CC BY-SA 3.0 조건을 공개 배포 전에 확인하고, 출처·촬영자를 크레딧에 표기한다. 제품 사진의 이용 권한도 별도로 확인한다.
