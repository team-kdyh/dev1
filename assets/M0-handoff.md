# M0 에셋 인계 · 1차

## 제공한 파일

- `asset-contract.md`: A/B/C와 확정할 규격 초안과 이벤트 요청.
- `art-direction.md`: 진영 톤, 18종 실루엣, 임시 상태 표현.
- `units.json`: 18종 임시 ID와 이름. C의 데이터 ID와 대조 후 확정 필요.
- `placeholders/units/{faction}/`: 18종 총 444개의 8비트 RGBA 플레이스홀더 프레임. 정식 아트는 `frames/units/{faction}/`에 같은 이름으로 넣으면 우선 사용된다.
- `atlases/`: 진영·티어군별 PNG/JSON Hash 4쌍. 각 페이지는 2048×2048 이내.
- `manifest.json`: 유닛 ID → 클립 FPS·반복 여부·아틀라스 프레임 참조.
- `previews/`: 컬러·흑백 비교 시트와 아틀라스 애니메이션 미리보기 페이지. 실행 방법은 `previews/README.md`에 있다.
- `tools/`: 생성, 패킹, 검증, 미리보기 스크립트. Python 3 표준 라이브러리만 사용.

## 실행 순서

```bash
python3 assets/tools/generate_placeholders.py
python3 assets/tools/pack_assets.py
python3 assets/tools/make_previews.py
python3 assets/tools/validate_assets.py
```

`package.json`에는 같은 작업을 위한 npm 스크립트가 있다. 현재 작업 환경에는 Node/npm이 없어 npm 실행은 검증하지 못했다.

## A가 바로 연결할 수 있는 규칙

1. C의 유닛 ID로 `manifest.units[id]`를 찾는다. ID는 현재 임시이므로 C와 먼저 대조한다.
2. `clips[state].frames[index]`의 `atlas` JSON을 로드하고 `frame` 키를 조회한다.
3. 아틀라스 프레임의 `spriteSourceSize`와 `sourceSize`로 trim 전 위치를 복원하고, 유닛 기준 앵커 `(0.5, 1.0)`을 적용한다.
4. idle/move는 반복한다. attack/cast/deploy/die는 1회 재생한다. die는 15fps, 나머지는 12fps다. 공격 클립의 `hitFrame`은 화면 효과 타이밍이며 시뮬 피해 시점을 바꾸지 않는다.
5. `stun`은 현재 별도 클립 없이 idle로 표시한다. `folded/unfolded`는 세미콘 T5에 제공된다. T1 페어는 같은 유닛 스프라이트를 두 개체에 사용한다.

## 아직 필요한 팀 확인

- **A:** 실제 렌더 화면에서 atlas JSON Hash 로딩·trim·앵커·좌우 반전·화면 축소를 확인. M0의 시각 DoD는 이 검수 전까지 미완료.
- **B:** 상태와 이벤트 계약, `idle` 조건, T1 페어, T5 변형, T8 과열 수치 필드 확정.
- **C:** `units.json`의 18개 ID와 `assets.sprite` 참조 방식 확정. 현재 `/data/balance`가 없어 자동 교차 검증은 보류.
- **팀:** Node/npm과 TexturePacker CLI 사용 환경 여부 결정. 현재 파이프라인은 외부 패커 없이 JSON Hash를 생성하므로 CLI가 없어도 M0 작업은 가능하다.

검증 상태: 생성 → 패킹 → 검증 명령 통과. 실제 게임 소스가 현 폴더에 없어 인게임 통합 검수는 수행할 수 없다.
