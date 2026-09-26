# 밸런스 데이터 계약

- `meta.json`의 `schemaVersion`은 구조 호환성, `balanceVersion`은 수치 세트를 식별한다.
- 유닛은 스킬 객체를 포함하지 않고 `skillId`를 참조한다.
- 모든 에셋 값은 파일 경로가 아닌 `assets.manifest.json`의 논리 키다.
- `roles`는 AI 조합 분석용이며 한 유닛이 여러 역할을 가질 수 있다.
- 스키마 또는 ID 계약을 바꾸려면 `schemaVersion`을 올린다.

현재 계약은 팀 합의 전 잠정안이며 `implementation-plan.md`의 C-DEC-01~10 권장안을 적용했다.
