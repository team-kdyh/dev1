# TECH WAR — 팀 통합 저장소

A 클라이언트, B Unity 시뮬레이션, C 밸런스·AI 도구, D 아트·사운드를 함께 관리합니다. 현재 웹 게임은 로컬 PvE 전투를 플레이할 수 있습니다.

| 트랙 | 코드와 산출물 | 인계 문서 |
| --- | --- | --- |
| A · 웹 클라이언트 | `src/app`, `src/render`, `src/ui` | [A 핸드오프](docs/HANDOFF.md) · [A 제작 설명](README.track-a.md) |
| B · Unity/C# 시뮬레이션 | `UnityProject/` | [B 핸드오프](TRACK_B_HANDOFF.md) |
| C · 밸런스·AI·도구 | `src/ai`, `src/data`, `tools/` | [C 핸드오프](docs/TRACK_C_HANDOFF.md) · [C 제작 설명](README.track-c.md) |
| D · 아트·사운드 | `assets/` | [D 핸드오프](HANDOFF.md) · [D 제작 설명](README.track-d.md) |

병합 대상·충돌 해결·검증 결과와 남은 연결 작업은 [통합 기록](docs/INTEGRATION.md)에 정리했습니다.

## 웹 클라이언트와 밸런스 도구

Node.js 24에서 저장소 루트에서 실행합니다.

```bash
npm ci
npm run dev       # A 웹 클라이언트
npm run editor    # C 밸런스 편집기, 별도 터미널에서 실행
npm run check     # 밸런스 검증, A·C 타입 검사, 테스트, 두 웹 빌드
```

`npm run build`는 웹 클라이언트와 실제 플레이에 필요한 이미지·오디오를 `dist/`에 담습니다. `npm run build:editor`는 편집기를 `dist/balance-editor/`에 만듭니다. 두 산출물이 필요하면 클라이언트 빌드 후 편집기를 빌드합니다. A·C의 타입 검사 옵션은 `tsconfig.json`과 `tsconfig.track-c.json`에서 각각 유지합니다. 하위 경로에 배포할 때는 `VITE_BASE_PATH=/dev1/ npm run build`처럼 경로를 지정합니다.

웹 클라이언트는 `LocalSimAdapter`, C의 밸런스 데이터, D의 캐릭터 아틀라스·전투 사운드를 연결했습니다. 온라인 대전과 Unity/C# 시뮬레이션 연동은 별도 작업입니다. 현재 빌드의 사용 방법과 검증 결과는 [플레이 빌드 인계](docs/PLAYABLE_GAME_HANDOFF.md), 정식 출시 전 남은 기준은 [출시 준비 점검](docs/RELEASE_READINESS.md)에 정리했습니다.

## Unity 시뮬레이션

Unity Hub에서 `UnityProject/`를 Unity **6000.3.2f1**로 열고 `Assets/Scenes/SampleScene.unity`를 실행합니다. 테스트와 .NET 헤드리스 실행 방법은 [Unity README](UnityProject/README.md)에 있습니다.

## 이미지와 오디오 미리보기

```bash
python3 -m http.server 8000
```

- 캐릭터 애니메이션: <http://localhost:8000/assets/previews/index.html>
- 이미지 전체: <http://localhost:8000/assets/image-gallery.html>
- 사운드: <http://localhost:8000/assets/audio/index.html>

에셋 경로, 재생성 명령, 검증 범위는 [D 핸드오프](HANDOFF.md)를 참고하세요.
