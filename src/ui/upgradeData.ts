import upgradesSource from '../data/balance/upgrades.json';

/**
 * 업그레이드 목록. (§4 업그레이드 패널)
 *
 * `BalanceData`에 업그레이드 필드가 없어 C의 `upgrades.json`을 직접 읽는다.
 * 계약에 들어오면 이 파일은 사라지고 `balance.upgrades`를 쓰면 된다.
 *
 * **효과 문구는 만들지 않는다.** 데이터에 `desc`가 없고, `effect.type`
 * (`cashRateFlat` 등)을 한글로 바꾸려면 코드에 문구 표를 적어야 하는데
 * 그건 "숫자와 문구는 코드에 없다" 원칙에 어긋난다.
 * C가 `desc`를 넣으면 그대로 렌더한다 — docs/contract-response-a.md §3.3 참고.
 */

export interface UpgradeDef {
  readonly id: string;
  readonly name: string;
  readonly maxLevel: number;
  readonly costs: readonly number[];
  /** C가 넣어주면 표시한다. 없으면 표시하지 않는다. */
  readonly desc?: string;
}

export const UPGRADES: readonly UpgradeDef[] =
  (upgradesSource as { upgrades?: UpgradeDef[] }).upgrades ?? [];
