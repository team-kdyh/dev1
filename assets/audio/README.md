# TECH WAR 전투 전자음악과 효과음

- 효과음 **67개**: 18종 유닛의 공격·사망·스킬 54개, UI/본진/시대/전략/승패/컷인 13개.
- BGM **8트랙**: 두 진영 각각 `bass_drums`, `synth`, `strings`, `age4`. 모두 **150 BPM, 16마디/25.6초**, 44.1kHz 스테레오. 세미콘은 D 단조의 거친 톱니파 베이스/신스와 공업적 드럼, 오차드는 F# 단조의 날카로운 아르페지오와 맑은 신스를 중심으로 한다. 양쪽 모두 4박 킥, 2·4박 스네어, 빠른 하이햇, 엇박 베이스를 사용한다.
- 원본 WAV는 `source/sfx`(44.1kHz 모노, 16-bit)와 `source/bgm`(44.1kHz 스테레오, 16-bit)에 보관한다. 배포용 파일은 `sfx`와 `bgm`의 OGG/MP3다.
- `manifest.json`에 경로와 샘플 단위 루프 지점을 기록했다. A의 오디오 재생기는 Age 1에 bass_drums, Age 2에 synth 추가, Age 3에 strings 추가, Age 4에 age4 전용 트랙으로 전환하면 된다. 레이어는 같은 시작 시점에 맞춰 재생하고 페이드로 음량을 조절한다.
- 세 레이어 동시 재생 시 여유를 위해 게임 내 BGM 버스 음량을 **0.5 이하**에서 시작하는 것을 제안한다. MP3 fallback 루프는 인코더 지연이 있을 수 있으므로 OGG를 우선한다.

## 듣기와 재생성

프로젝트 루트에서 `python3 -m http.server 8000`을 실행하고 브라우저에서 `http://localhost:8000/assets/audio/`를 열면 Age 1~3 레이어 합주, Age 4 전용곡, 개별 파일을 들을 수 있다. `file://`로 열면 JSON 요청이 차단될 수 있다.

재생성하려면 FFmpeg 변환기가 필요하다. 시스템에 FFmpeg가 없으면 Python 가상 환경에서 아래 패키지를 설치한다.

```bash
python3 -m pip install -r assets/tools/requirements-audio.txt
python3 assets/tools/generate_audio.py
python3 assets/tools/validate_audio.py
```

현재 효과음과 음악은 코드 합성 방식으로 만든 게임용 초안이다. 포맷·길이·피크·디코딩 검증은 자동화했으며, 실제 스피커/헤드폰 청취와 게임 내 믹스·반복 피로도 평가는 아직 필요하다.
