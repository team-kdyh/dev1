# 트랙 C 계약 결정 기록

> 상태: **잠정 구현안**. 팀 합의 전에는 승인된 공용 계약이 아니다.

| ID | 잠정 결정 | 코드 반영 위치 | 승인 필요 상대 |
| --- | --- | --- | --- |
| C-DEC-01 | 스킬은 별도 JSON에 저장하고 유닛은 ID로 참조 | `src/data/balance/skills`, `units` | B |
| C-DEC-02 | 데이터 루트는 `/src/data` | `src/data` | 전원 |
| C-DEC-03 | 익스퍼트 자원 효율은 95% | `difficulties.json` | 전원 |
| C-DEC-04 | 방어 타입은 `light/heavy/structure` | `unit.schema.json`, `damage_matrix.json` | B |
| C-DEC-05 | 구조 버전과 수치 버전을 별도 관리 | `meta.json` | 전원 |
| C-DEC-06 | 에셋은 논리 키로 참조 | `assets.manifest.json` | D |
| C-DEC-07 | 15틱마다 판단하고 난이도 지연 후 커맨드 실행 | `src/ai/controller.ts` | B |
| C-DEC-08 | AI 조합 판별용 `roles[]` 추가 | 유닛 JSON과 스키마 | A/B |
| C-DEC-09 | 트리거/조건/대상 선택자와 효과 프리미티브를 분리 | 스킬 JSON과 스키마 | B |
| C-DEC-10 | AI에 결정론적 RNG 인터페이스 주입 | `src/ai/types.ts`, `rng.ts` | B |

## 트랙 B 연결 체크리스트

- [ ] `SimulationSnapshot` 필드와 단위 확정
- [ ] `Command` payload와 거부 사유 확정
- [ ] headless 러너 생명주기 확정
- [ ] AI용 RNG를 공용 스트림으로 할지 파생 스트림으로 할지 확정
- [ ] 스킬 조건·선택자 계약 확정
- [ ] 이벤트 텔레메트리 스키마 확정
- [ ] 상태 해시와 밸런스 버전 포함 범위 확정

## 변경 규칙

공용 계약 변경은 주간 4인 동기화에서 승인한다. JSON 구조가 바뀌면 `schemaVersion`, 수치만 바뀌면 `balanceVersion`을 올리고 변경 로그에 마이그레이션 필요 여부를 기록한다.
