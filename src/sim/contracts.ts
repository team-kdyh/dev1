/**
 * contracts.ts — A/B/C/D 공용 계약.
 *
 * 소유: B(시뮬). A는 이 파일의 **타입만** import 한다.
 * `/src/sim` 안의 다른 파일은 절대 import 하지 않는다. (마스터 §12)
 *
 * 현재 파일은 M0 3일차 "계약 3종 합의" 전의 A측 초안이다.
 * B가 정식 contracts.ts를 내리면 이 파일을 통째로 교체한다.
 */

export const TICK_HZ = 30;
export const TICK_MS = 1000 / TICK_HZ;

/** 논리 좌표계: 0(좌측 본진) ~ 1000(우측 본진) */
export const LOGICAL_MAX = 1000;

export type PlayerId = 0 | 1;
export type UnitId = number;
export type UnitDefId = string;

export type UnitState = 'idle' | 'move' | 'attack' | 'die' | 'deploy' | 'cast';

// ---------------------------------------------------------------------------
// Snapshot — 매 틱 시뮬이 내놓는 읽기 전용 게임 상태
// ---------------------------------------------------------------------------

export interface UnitSnapshot {
  readonly id: UnitId;
  readonly defId: UnitDefId;
  readonly owner: PlayerId;
  readonly tier: number;
  /** 논리 x (0~1000). Y는 시뮬에 없다 — 프론트가 부여한다. */
  readonly x: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly state: UnitState;
  /** 바라보는 방향. +1 = 오른쪽 */
  readonly facing: 1 | -1;
}

export interface ProjectileSnapshot {
  readonly id: number;
  readonly defId: string;
  readonly owner: PlayerId;
  readonly x: number;
  /** 0~1, 발사~착탄 진행도. 프론트가 포물선 Y를 만들 때 쓴다. */
  readonly progress: number;
}

export interface QueueItemSnapshot {
  readonly defId: UnitDefId;
  /** 선두 항목만 0~1, 나머지는 0 */
  readonly progress: number;
}

export interface PlayerSnapshot {
  readonly cash: number;
  readonly supply: number;
  readonly supplyMax: number;
  readonly age: number;
  readonly baseHp: number;
  readonly baseMaxHp: number;
  /** defId -> 남은 쿨다운 ms */
  readonly cooldowns: Readonly<Record<UnitDefId, number>>;
  readonly unlockedTiers: readonly number[];
  readonly queue: readonly QueueItemSnapshot[];
}

export interface Snapshot {
  readonly tick: number;
  readonly elapsedMs: number;
  readonly units: readonly UnitSnapshot[];
  readonly projectiles: readonly ProjectileSnapshot[];
  readonly players: readonly [PlayerSnapshot, PlayerSnapshot];
  /** 이 클라이언트가 조종하는 진영 */
  readonly me: PlayerId;
  readonly phase: 'playing' | 'over';
  readonly winner?: PlayerId;
}

// ---------------------------------------------------------------------------
// Command — 프론트 → 시뮬
// ---------------------------------------------------------------------------

export type Command =
  | { type: 'SPAWN_UNIT'; defId: UnitDefId }
  | { type: 'CANCEL_QUEUE'; index: number }
  | { type: 'AGE_UP' }
  | { type: 'USE_STRATEGY'; slot: 0 | 1 }
  | { type: 'BUY_UPGRADE'; upgradeId: string };

// ---------------------------------------------------------------------------
// SimEvent — 시뮬 → 프론트 (연출 트리거 전용, 상태 아님)
// ---------------------------------------------------------------------------

export type RejectReason =
  | 'NO_CASH'
  | 'NO_SUPPLY'
  | 'COOLDOWN'
  | 'LOCKED'
  | 'QUEUE_FULL'
  | 'GAME_OVER';

export type SimEvent =
  | { type: 'spawn'; unitId: UnitId; defId: UnitDefId; owner: PlayerId; x: number }
  | { type: 'hit'; unitId: UnitId; x: number; amount: number; crit: boolean }
  | { type: 'kill'; unitId: UnitId; defId: UnitDefId; owner: PlayerId; x: number }
  | { type: 'skill'; unitId: UnitId; skillId: string; x: number }
  | { type: 'ageup'; owner: PlayerId; age: number }
  | { type: 'baseHit'; owner: PlayerId; amount: number }
  | { type: 'strategy'; owner: PlayerId; slot: 0 | 1; strategyId: string }
  | { type: 'rejected'; command: Command; reason: RejectReason }
  | { type: 'gameOver'; winner: PlayerId };

// ---------------------------------------------------------------------------
// Balance — 소유: C. 도감/툴팁/유닛 바가 그대로 렌더한다. (하드코딩 금지)
// ---------------------------------------------------------------------------

export interface UnitDef {
  readonly id: UnitDefId;
  readonly name: string;
  readonly tier: number;
  readonly faction: string;
  readonly cost: number;
  readonly supply: number;
  readonly buildMs: number;
  readonly cooldownMs: number;
  readonly hp: number;
  readonly dps: number;
  /** 논리 단위 사거리 */
  readonly range: number;
  /** 논리 단위 / 초 */
  readonly speed: number;
  /** C 밸런스 데이터의 설명과 스킬명. 도감과 툴팁이 사용한다. */
  readonly description: string;
  readonly roles: readonly string[];
  readonly skills: readonly string[];
}

export interface BalanceData {
  readonly units: readonly UnitDef[];
  readonly ageUpCost: readonly number[];
  readonly cashPerSecond: number;
  readonly supplyMax: number;
  readonly baseHp: number;
  readonly queueMax: number;
}
