# TECH WAR — 트랙 C

밸런스 데이터, PvE AI, 캠페인/메타 콘텐츠, 자동 대전 분석 도구를 소유하는 패키지다.

## 시작

```bash
npm install
npm run check
npm run editor
```

## 주요 명령

- `npm run validate:balance`: JSON Schema와 참조 무결성 검사
- `npm test`: 데이터/AI/배치 도구 테스트
- `npm run editor`: 밸런스 테이블 편집기 실행
- `npm run batch -- --adapter smoke --n 20 --out reports/smoke.csv`: 도구 파이프라인만 검증하는 스모크 실행

`smoke` 어댑터의 결과는 밸런스 판단에 사용할 수 없다. 트랙 B의 headless 러너가 준비되면 `tools/batch/adapters/project.ts`의 팩토리를 연결해야 한다.

구현 범위와 순서는 [implementation-plan.md](./implementation-plan.md)를 따른다.
