# A·B·C·D 브랜치 통합 기록

기준일: 2026-09-26. 대상은 저장소 기본 브랜치 `gjtjw/track-c-docs`다.

## 포함한 작업 브랜치

| 트랙 | 브랜치 | 원본 마지막 커밋 |
| --- | --- | --- |
| A | `feat/track-a-client` | `7d5fbcf` |
| B | `feat/track-b-unity-simulation` | `32a93bf` |
| C | `feat/track-c-implementation` | `4d55e2e` |
| D | `feat/track-d-art-audio-final` | `5af0738` |

각 브랜치를 merge commit으로 합쳐 원본 이력을 보존했다. 파일과 제작 도구를 한 저장소에서 사용할 수 있으며, 실제 전투에서 모든 트랙을 연결하는 작업은 아래와 같이 남아 있다.

## 충돌 해결

- `package.json`: A·C의 의존성과 A·C·D의 실행 명령을 합쳤다. Node.js 24를 사용하며 lockfile을 다시 생성해 `npm ci`로 검증했다.
- TypeScript: A의 옵션과 C의 더 엄격한 옵션을 유지하도록 `tsconfig.json`과 `tsconfig.track-c.json`으로 검사 대상을 나눴다. `npm run typecheck`가 둘 다 검사한다.
- `README.md`: 팀 공통 실행 안내로 정리했다. A·C·D 원문은 루트의 `README.track-a.md`, `README.track-c.md`, `README.track-d.md`에 보존했다.
- 역할 명세: 루트 `내역할기능명세서.md`는 A 브랜치의 문서다. 기본 브랜치에 있던 C 역할 원문은 [roles/track-c.md](roles/track-c.md)에 보존했다.
- `.gitignore`: 각 트랙의 제외 규칙을 합쳤다.
- CI: 실제 기본 브랜치로 push할 때 웹 검사와 D 에셋 검사가 실행되도록 수정했다.
- Unity 프로젝트와 사용자 지정 `M0Balance.cs` 수치는 원본 그대로 유지했다.

## 병합 후 로컬 검증

| 검사 | 결과 |
| --- | --- |
| `npm ci` | 통합 lockfile로 설치 성공 |
| `npm run check` | A·C 타입 검사, 밸런스 15개 파일 검증, 7개 파일의 테스트 13개, 웹 클라이언트·편집기 빌드 통과 |
| `npm run batch -- --adapter smoke --n 20 --seed 1000 --out reports/integration-smoke.csv` | 20회 실행과 리포트 생성 성공. 실제 밸런스 판정에 사용할 수 없는 스모크 결과 |
| `python3 assets/tools/validate_assets.py` | 유닛 18종, 원본·패킹 프레임 각 444개, 아틀라스 4장, 효과음 67개, BGM 8개 통과 |

이 환경에는 Unity/.NET SDK가 없어 B의 실행·테스트를 수행하지 않았다. FFmpeg가 없어 OGG/MP3 실제 디코딩 검사는 수행하지 않았다. 이번 검증은 브라우저 실플레이나 전 트랙의 실제 전투 연동을 포함하지 않는다.

## 남은 연결 작업

1. **A ↔ B 런타임 계약:** A는 TypeScript/PixiJS, B는 Unity/C#이다. 웹의 `FakeSimAdapter`를 실제 시뮬레이션으로 교체하려면 포팅 또는 연결 어댑터와 Snapshot/Command 계약을 정해야 한다.
2. **A ↔ C 데이터:** 웹은 `src/data/placeholderBalance.ts`를 사용한다. C의 `src/data/balance/` 데이터를 A 계약으로 연결하는 작업이 필요하다.
3. **A·C ↔ D 에셋:** C의 `src/data/assets.manifest.json`은 계속 플레이스홀더여서 밸런스 검증에 경고 1개가 나온다. D의 `assets/manifest.json`과 다른 스키마이므로 논리 키 매핑과 이미지·오디오 로더가 필요하다.
4. **C ↔ D 교차 검증:** D 검증기는 루트 `data/balance/`를 찾고 C 데이터는 `src/data/balance/`에 있다. 현재 D 검증 통과는 C의 `assets.sprite`와 실제 이미지 ID 사이의 검증을 의미하지 않는다.
5. **C ↔ B 배치 실행:** C의 실제 경기용 `project` 어댑터는 미연결이다. 현재 스모크 배치로 승률이나 밸런스를 확정하지 않는다.

트랙별 자세한 인계는 루트 [README](../README.md)의 링크를 따른다. 각 트랙의 기존 핸드오프는 해당 단독 브랜치 시점의 기록이므로, 병합 상태는 이 문서를 기준으로 확인한다.
