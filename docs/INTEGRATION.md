# A·B·C·D 브랜치 통합 기록

기준일: 2026-09-26. 대상은 저장소 기본 브랜치 `gjtjw/track-c-docs`다.

## 포함한 작업 브랜치

| 트랙 | 브랜치 | 원본 마지막 커밋 |
| --- | --- | --- |
| A | `feat/track-a-client` | `7d5fbcf` |
| B | `feat/track-b-unity-simulation` | `32a93bf` |
| C | `feat/track-c-implementation` | `4d55e2e` |
| D | `feat/track-d-art-audio-final` | `5af0738` |

각 브랜치를 merge commit으로 합쳐 원본 이력을 보존했다. 이후 `integration/active-tracks-character-polish`에서 A 클라이언트가 C 밸런스와 D 캐릭터를 실제 런타임에 사용하도록 연결했다. B의 Unity 프로젝트도 같은 저장소에 보존되지만 기술 스택이 달라 웹 프로세스에는 직접 포함하지 않는다.

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
| `npm run check` | A·C 타입 검사, 밸런스 15개 파일 검증, 8개 파일의 테스트 16개, 웹 클라이언트·편집기 빌드 통과 |
| `npm run batch -- --adapter smoke --n 20 --seed 1000 --out reports/integration-smoke.csv` | 20회 실행과 리포트 생성 성공. 실제 밸런스 판정에 사용할 수 없는 스모크 결과 |
| `python3 assets/tools/validate_assets.py` | 유닛 18종, 원본·패킹 프레임 각 444개, 아틀라스 4장, 효과음 67개, BGM 8개 통과 |

이 환경에는 Unity/.NET SDK가 없어 B의 실행·테스트를 수행하지 않았다. FFmpeg가 없어 OGG/MP3 실제 디코딩 검사는 수행하지 않았다. 브라우저 자동 화면 캡처 환경도 제공되지 않아 시각 검수는 D의 콘택트 시트와 빌드·프레임 무결성 검사로 대체했다.

## 런타임 연결 완료

- **A ↔ C:** `src/data/balanceData.ts`가 C JSON을 A의 `BalanceData` 계약으로 변환한다. 임시 데이터 모듈은 호환용 재수출만 남겼다.
- **A·C ↔ D:** `src/data/assetMap.ts`가 이름이 다른 8개 ID를 명시적으로 매핑하고, `src/render/unitAssets.ts`가 4개 PixiJS 아틀라스와 상태별 클립을 로드한다.
- **캐릭터 표현:** 전투의 `idle/move/attack/die/deploy/cast`, 유닛 버튼, 생산 큐, 도감이 동일한 D 캐릭터를 사용한다. 누락 시에만 기존 도형 텍스처로 안전하게 대체한다.
- **도감:** C의 한국어 설명, 역할, 스킬명과 D의 캐릭터 프리뷰를 함께 표시한다.
- **교차 검증:** 자동 테스트가 C의 18개 게임플레이 ID가 서로 다른 D 캐릭터 18종과 실제 아틀라스 프레임에 모두 대응하는지 검사한다.

## 남은 연결 작업

1. **A ↔ B 런타임 계약:** A는 TypeScript/PixiJS, B는 Unity/C#이다. 웹의 `FakeSimAdapter`를 B 시뮬레이션으로 교체하려면 TypeScript 포팅, WebAssembly, 또는 별도 프로세스 브리지 중 하나를 결정해야 한다.
2. **D 오디오 런타임:** 파일·매니페스트·무결성 검사는 통과하지만 A의 이벤트에 SFX/BGM을 재생하는 오디오 디렉터는 아직 없다.
3. **C ↔ B 배치 실행:** C의 실제 경기용 `project` 어댑터는 미연결이다. 현재 스모크 배치로 승률이나 밸런스를 확정하지 않는다.

트랙별 자세한 인계는 루트 [README](../README.md)의 링크를 따른다. 각 트랙의 기존 핸드오프는 해당 단독 브랜치 시점의 기록이므로, 병합 상태는 이 문서를 기준으로 확인한다.
