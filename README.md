# TECH WAR — 팀 통합 저장소

A 클라이언트, B Unity 시뮬레이션, C 밸런스·AI 도구, D 아트·사운드를 기본 브랜치 `gjtjw/track-c-docs`에서 함께 관리합니다.

| 트랙 | 코드와 산출물 | 인계 문서 |
| --- | --- | --- |
| A · 웹 클라이언트 | `src/app`, `src/render`, `src/ui` | [A 핸드오프](docs/HANDOFF.md) · [A 제작 설명](README.track-a.md) |
| B · Unity/C# 시뮬레이션 | `UnityProject/` | [B 핸드오프](TRACK_B_HANDOFF.md) |
| C · 밸런스·AI·도구 | `src/ai`, `src/data`, `tools/` | [C 핸드오프](docs/TRACK_C_HANDOFF.md) · [C 제작 설명](README.track-c.md) |
| D · 아트·사운드 | `assets/` | [D 핸드오프](HANDOFF.md) |

## 웹 클라이언트와 밸런스 도구

Node.js 24에서 저장소 루트에서 실행합니다.

```bash
npm ci
npm run dev       # A 웹 클라이언트
npm run editor    # C 밸런스 편집기, 별도 터미널에서 실행
npm run check     # 밸런스 검증, A·C 타입 검사, 테스트, 두 웹 빌드
```

`npm run build`는 웹 클라이언트를 `dist/`에, `npm run build:editor`는 편집기를 `dist/balance-editor/`에 만듭니다. 두 산출물이 필요하면 클라이언트 빌드 후 편집기를 빌드합니다. A·C의 타입 검사 옵션은 `tsconfig.json`과 `tsconfig.track-c.json`에서 각각 유지합니다.

현재 웹 클라이언트는 `FakeSimAdapter`와 임시 밸런스·텍스처를 사용합니다. B의 C# 시뮬레이션, C의 정식 데이터, D의 스프라이트·오디오를 실제 게임에 연결하는 작업은 남아 있습니다. 트랙별 핸드오프의 미결 계약을 확인하세요.

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
