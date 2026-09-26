# 스킬 표현 가능성 감사

> 판정 기준: JSON 표현은 완료했다. 실제 실행 가능 여부는 트랙 B의 조건/대상 선택자 지원이 확정되어야 하므로 현재 전부 **B 계약 대기**다.

## 공통 계약 요청

효과 프리미티브 10종은 유지하고 다음을 공통 문법으로 지원한다.

- 트리거: 스폰/사망/피격/처치/공격 전후/간격/오라/자동·수동 액티브
- 조건: HP 비율, 주변 유닛 수, 정지 시간, 공격·처치 횟수, 스택, 상태, 대상 타입
- 선택자: 현재 대상, 반경, 전방/후방, 부채꼴, 최저 HP, 최원거리, 최고 티어/전투력
- 수명주기: 지속시간, 최대 사용 횟수, 효과 만료 시 처리, 링크된 유닛

## 세미콘

| 유닛 | 데이터 ID | 필요한 실행기 기능 | 상태 |
| --- | --- | --- | --- |
| 버즈 트윈스 | `semicon_buds_pair` | 페어 소환, 파트너 링크, 파트너 사망 감지 | B 계약 대기 |
| 워치 메딕 | `semicon_heart_monitor` | 주기 회복, 반경 내 낮은 HP 3기 선택 | B 계약 대기 |
| 워치 메딕 | `semicon_emergency_call` | HP 20% 조건, 자동 액티브 | B 계약 대기 |
| A폰 보병 | `semicon_crowd_mode` | 동일 유닛 주변 수 조건 | B 계약 대기 |
| S폰 저격수 | `semicon_long_exposure` | 정지 시간, 이동 중 페널티, 다음 공격 치명타 | B 계약 대기 |
| 폴드 방패병 | `semicon_fold_toggle` | 시간 기반 상태 토글 | B 계약 대기 |
| 탭 포병 | `semicon_pen_throw` | 공격 횟수, 다음 공격 형태 변경, 최소 사거리 | B 계약 대기 |
| 북 워크스테이션 | `semicon_dex_mode` | 최초 설치 후 영구 이동 불가 | B 계약 대기 |
| 북 워크스테이션 | `semicon_extended_display` | 설치 상태 조건 오라 | B 계약 대기 |
| AI 어시스턴트 | `semicon_malfunction` | 피격 대상 중심 광역 상태 | B 계약 대기 |
| AI 어시스턴트 | `semicon_routine_execute` | 스킬 봉인 상태 | B 계약 대기 |
| 회장 | `semicon_vertical_integration` | 전장 전체 오라와 최대 HP 변경 | B 계약 대기 |
| 회장 | `semicon_increase_production` | 인구 미소모 다중 소환 | B 계약 대기 |
| 회장 | `semicon_acquisition` | 임시 소유권 변경, 면역, 만료 시 사망 | B 계약 대기 |

## 오차드

| 유닛 | 데이터 ID | 필요한 실행기 기능 | 상태 |
| --- | --- | --- | --- |
| 에어팟 듀오 | `orchard_noise_cancel` | 사망 지점 광역 침묵 | B 계약 대기 |
| 워치 트레이너 | `orchard_trainer_heal` | 주기 회복 | B 계약 대기 |
| 워치 트레이너 | `orchard_close_rings` | 처치 주체 추적, 3회마다 영구 스택 | B 계약 대기 |
| 폰 기본형 | `orchard_ecosystem_protection` | 주변 아군 존재 조건 | B 계약 대기 |
| 폰 프로 | `orchard_dynamic_aim` | 최저 HP 타겟, 처치 시 공격 쿨 초기화 | B 계약 대기 |
| 패드 방패병 | `orchard_large_screen` | 뒤쪽 아군에 원거리 피해만 감소 | B 계약 대기 |
| 패드 방패병 | `orchard_pencil_stab` | 자동 액티브 피해와 기절 | B 계약 대기 |
| 비전 헤드셋 | `orchard_illusion` | 자기 복제, 수명, 공격 불가, 어그로 우선 | B 계약 대기 |
| 비전 헤드셋 | `orchard_spawn_ghost` | 역할별 타겟 제외 | B 계약 대기 |
| 에어 노트북 | `orchard_fanless` | 과열 비활성 플래그 | B 계약 대기 |
| 프로 노트북 | `orchard_performance_mode` | 공격 스택, 최대 스택 쿨링 상태 | B 계약 대기 |
| 프로 노트북 | `orchard_structure_bonus` | 구조물 대상 추가 배율 | B 계약 대기 |
| 창업자 | `orchard_reality_distortion` | 아군/적에게 다른 오라 효과 | B 계약 대기 |
| 창업자 | `orchard_presentation` | 전방 부채꼴 이동 정지 | B 계약 대기 |
| 창업자 | `orchard_one_more_thing` | 1회 한정, 전장 회복과 시간제 버프 | B 계약 대기 |

## 결론

단순한 효과 타입 추가보다 트리거·조건·대상 선택자 계약이 핵심이다. 현재 데이터에는 모든 명세 능력이 들어 있지만, 트랙 B가 위 공통 문법을 지원하기 전까지 “실행 완료”로 간주하지 않는다.
