import type {
  BalanceData,
  Command,
  PlayerId,
  PlayerSnapshot,
  ProjectileStyle,
  RejectReason,
  SimEvent,
  Snapshot,
  UnitDef,
  UnitSnapshot,
  UnitState,
} from '../sim/contracts';
import { FACTION_OF_PLAYER, unitsOfFaction } from '../data/balanceData';
import { FixedStepLoop, LOGICAL_MAX, TICK_MS, type SimAdapter } from './SimAdapter';
import {
  SKILL_EVERY_ATTACKS,
  blockChanceFor,
  isRangedAttack,
  projectileDurationMs,
  projectileStyleFor,
} from './combatRules';

/**
 * 진짜 시뮬(B)이 오기 전까지 프론트를 끝까지 만들기 위한 가짜 시뮬. (명세 §1.1)
 *
 * 밸런스가 맞을 필요도, 결정론적일 필요도 없다. 필요한 건
 * "스냅샷이 30틱으로 갱신되고 이벤트가 흘러나온다"는 사실뿐이다.
 * M1 3주차에 LocalSimAdapter로 통째로 교체된다 — 이 파일은 그때 지운다.
 */

interface FakeUnit {
  id: number;
  def: UnitDef;
  owner: PlayerId;
  x: number;
  hp: number;
  state: UnitState;
  facing: 1 | -1;
  attackCdMs: number;
  attackCount: number;
  castMs: number;
  /** 뒤를 기다린 누적 시간 — 상한을 넘으면 그냥 전진한다 */
  musterMs: number;
}

interface FakeProjectile {
  id: number;
  defId: string;
  owner: PlayerId;
  sourceUnitId: number;
  targetUnitId?: number;
  targetOwner?: PlayerId;
  fromX: number;
  toX: number;
  elapsedMs: number;
  durationMs: number;
  damage: number;
  crit: boolean;
  style: ProjectileStyle;
}

interface FakePlayer {
  cash: number;
  age: number;
  baseHp: number;
  cooldowns: Record<string, number>;
  unlockedTiers: number[];
  queue: { def: UnitDef; elapsedMs: number }[];
}

const CONTACT_PAD = 4;
const BASE_EDGE_REACH = 34;
/** 아군 간 최소 간격. 좁을수록 뭉쳐 보인다 — 렌더가 id별 Y 레인을 주므로 겹쳐 보이지 않는다. */
const ALLY_SPACING = 9;
/**
 * 바로 뒤 아군과 이만큼 넘게 벌어지면 기다린다 — 혼자 달려나가 1:1로 죽는 걸 막는다.
 * 본대 중심(평균)과 비교하면 평균에 선두 자신이 섞여 제약이 절반으로 희석되므로
 * 반드시 **바로 뒤 아군과의 실제 간격**으로 재야 한다.
 */
const MUSTER_GAP = 30;
/** 이 거리 안의 아군만 같은 본대로 본다. 멀리 있는 증원을 기다리다 전진이 멈추지 않게. */
const COHESION_WINDOW = 220;
/**
 * 한 유닛이 뒤를 기다릴 수 있는 최대 시간.
 *
 * 상한이 없으면 교착된다 — 생산이 계속되는 동안 선두 뒤에는 항상 새 낙오자가
 * 생기므로 선두가 영구히 멈춰 서고, 최악의 경우 양측이 아예 만나지 못한다.
 */
const MUSTER_MAX_MS = 1200;
/** 본대보다 뒤처진 유닛의 가속 배율 — 한 줄로 늘어지지 않고 합류한다. */
const CATCHUP_SPEED = 1.6;
/** 원거리 유닛이 근접 벽 뒤에 유지하는 거리 */
const RANGED_HOLD_MIN = 26;

/** 한 진영의 본대 상태 */
interface PackInfo {
  /** 본대 중심 x (평균) */
  packX: number;
  /** 가장 앞선 근접 아군 x — 원거리가 이 뒤에 선다. 없으면 null */
  meleeFrontX: number | null;
  count: number;
}
const AI_SPAWN_INTERVAL_MS = 2500;
const SKILL_DAMAGE_MULTIPLIER = 1.55;
const BLOCKED_DAMAGE_MULTIPLIER = 0.35;
const CAST_MS = 420;

/** 실제 플레이 체감 속도. setTimeScale 인자는 이 값을 기준으로 한 상대 배율이다. */
export const DEMO_TIME_SCALE = 0.72;

/**
 * 쇼케이스용 캐시 수급 배율. **FakeSim 전용이며 C의 밸런스 JSON은 건드리지 않는다.**
 *
 * 계측 결과 기본 수급(8/s)에서는 내 유닛이 동시에 2~3기만 살아 있어
 * 무엇을 해도 1:1 교전이 된다 — 뭉칠 몸 자체가 없다.
 * 프론트의 대열·사격선 연출을 보여주려면 전선에 유닛이 쌓여야 하므로 여기서만 올린다.
 *
 * **밸런스 결정이 아니다.** 실제 수급 곡선은 C가 정하고 B의 시뮬이 적용한다.
 * 이 상수는 LocalSimAdapter 교체 시 이 파일과 함께 사라진다.
 */
export const DEMO_CASH_MULTIPLIER = 2.6;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class FakeSimAdapter implements SimAdapter {
  private readonly loop: FixedStepLoop;
  private readonly rng: () => number;
  private readonly balance: BalanceData;
  private readonly me: PlayerId = 0;

  private tick = 0;
  private nextUnitId = 1;
  private nextProjectileId = 1;
  private units: FakeUnit[] = [];
  private projectiles: FakeProjectile[] = [];
  private players: [FakePlayer, FakePlayer];
  private aiTimerMs = 1200;
  private winner: PlayerId | null = null;

  private pending: SimEvent[] = [];
  private listeners: ((events: SimEvent[]) => void)[] = [];

  // 직전 스냅샷은 프론트가 §2.2대로 직접 보관한다 — 시뮬은 현재 것만 들고 있으면 된다.
  private currSnapshot: Snapshot;

  constructor(balance: BalanceData, seed = 1337) {
    this.balance = balance;
    this.rng = mulberry32(seed);
    this.players = [this.makePlayer(), this.makePlayer()];
    this.loop = new FixedStepLoop(TICK_MS, () => this.step());
    this.loop.timeScale = DEMO_TIME_SCALE;
    this.currSnapshot = this.buildSnapshot();
  }

  // -- SimAdapter ----------------------------------------------------------

  getSnapshot(): Snapshot {
    return this.currSnapshot;
  }

  start(): void {
    this.loop.start();
  }

  stop(): void {
    this.loop.stop();
  }

  onEvents(cb: (events: SimEvent[]) => void): void {
    this.listeners.push(cb);
  }

  setTimeScale(scale: number): void {
    this.loop.timeScale = DEMO_TIME_SCALE * scale;
  }

  send(cmd: Command): void {
    const player = this.players[this.me];
    switch (cmd.type) {
      case 'SPAWN_UNIT': {
        const def = this.balance.units.find((u) => u.id === cmd.defId);
        if (!def) return;
        const reason = this.rejectSpawn(this.me, def);
        if (reason) {
          this.emit({ type: 'rejected', command: cmd, reason });
          return;
        }
        player.cash -= def.cost;
        player.cooldowns[def.id] = def.cooldownMs;
        player.queue.push({ def, elapsedMs: 0 });
        break;
      }
      case 'CANCEL_QUEUE': {
        const item = player.queue[cmd.index];
        if (!item) return;
        player.queue.splice(cmd.index, 1);
        player.cash += Math.floor(item.def.cost * 0.8); // 80% 환불은 시뮬 담당 (§4.2)
        break;
      }
      case 'AGE_UP': {
        const cost = this.balance.ageUpCost[player.age];
        if (cost === undefined) {
          this.emit({ type: 'rejected', command: cmd, reason: 'LOCKED' });
          return;
        }
        if (player.cash < cost) {
          this.emit({ type: 'rejected', command: cmd, reason: 'NO_CASH' });
          return;
        }
        player.cash -= cost;
        player.age += 1;
        player.unlockedTiers = unlockedForAge(player.age);
        this.emit({ type: 'ageup', owner: this.me, age: player.age });
        break;
      }
      case 'USE_STRATEGY':
        this.emit({ type: 'strategy', owner: this.me, slot: cmd.slot, strategyId: `fake_${cmd.slot}` });
        break;
      case 'BUY_UPGRADE':
        // FakeSim은 업그레이드를 모델링하지 않는다. 조용히 무시.
        break;
    }
  }

  // -- 판정 ----------------------------------------------------------------

  /** 프론트(§4.1)와 같은 규칙. 어긋나면 버그라는 걸 증명하기 위해 일부러 중복 구현. */
  private rejectSpawn(owner: PlayerId, def: UnitDef): RejectReason | null {
    const p = this.players[owner];
    if (this.winner !== null) return 'GAME_OVER';
    if (!p.unlockedTiers.includes(def.tier)) return 'LOCKED';
    if (p.queue.length >= this.balance.queueMax) return 'QUEUE_FULL';
    if ((p.cooldowns[def.id] ?? 0) > 0) return 'COOLDOWN';
    if (p.cash < def.cost) return 'NO_CASH';
    if (this.supplyOf(owner) + def.supply > this.balance.supplyMax) return 'NO_SUPPLY';
    return null;
  }

  private supplyOf(owner: PlayerId): number {
    let total = 0;
    for (const u of this.units) if (u.owner === owner) total += u.def.supply;
    for (const q of this.players[owner].queue) total += q.def.supply;
    return total;
  }

  // -- 시뮬 루프 -----------------------------------------------------------

  private step(): void {
    if (this.winner !== null) {
      this.flush();
      return;
    }

    this.tick += 1;
    const dt = TICK_MS / 1000;

    for (let i = 0; i < 2; i += 1) {
      const p = this.players[i];
      p.cash += this.balance.cashPerSecond * DEMO_CASH_MULTIPLIER * dt;
      for (const key of Object.keys(p.cooldowns)) {
        p.cooldowns[key] = Math.max(0, p.cooldowns[key] - TICK_MS);
      }
      this.stepQueue(i as PlayerId, p);
    }

    this.stepAi();
    this.stepUnits(dt);

    this.currSnapshot = this.buildSnapshot();
    this.flush();
  }

  private stepQueue(owner: PlayerId, p: FakePlayer): void {
    const head = p.queue[0];
    if (!head) return;
    head.elapsedMs += TICK_MS;
    if (head.elapsedMs < head.def.buildMs) return;
    p.queue.shift();
    this.spawn(owner, head.def);
  }

  private spawn(owner: PlayerId, def: UnitDef): void {
    const x = owner === 0 ? 24 : LOGICAL_MAX - 24;
    const unit: FakeUnit = {
      id: this.nextUnitId++,
      def,
      owner,
      x,
      hp: def.hp,
      state: 'move',
      facing: owner === 0 ? 1 : -1,
      attackCdMs: 0,
      attackCount: 0,
      castMs: 0,
      musterMs: 0,
    };
    this.units.push(unit);
    this.emit({ type: 'spawn', unitId: unit.id, defId: def.id, owner, x });
  }

  private stepAi(): void {
    const ai = this.players[1];
    this.aiTimerMs -= TICK_MS;
    if (this.aiTimerMs > 0) return;
    this.aiTimerMs = AI_SPAWN_INTERVAL_MS;

    const pool = unitsOfFaction(this.balance, FACTION_OF_PLAYER[1]).filter(
      (d) => this.rejectSpawn(1, d) === null,
    );
    if (pool.length === 0) return;
    const def = pool[Math.floor(this.rng() * pool.length)];
    ai.cash -= def.cost;
    ai.cooldowns[def.id] = def.cooldownMs;
    ai.queue.push({ def, elapsedMs: 0 });
  }

  /**
   * 진영별 본대 정보. 뭉쳐 움직이기와 원거리 사격선 유지에 쓴다.
   * FakeSim 전용 — B의 시뮬이 붙으면 이 판단은 시뮬 쪽으로 간다.
   */
  private computePacks(): [PackInfo, PackInfo] {
    const acc = [
      { sum: 0, n: 0, melee: null as number | null },
      { sum: 0, n: 0, melee: null as number | null },
    ];

    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const a = acc[unit.owner];
      a.sum += unit.x;
      a.n += 1;
      // 가장 앞선 근접 아군 = 벽. 원거리는 이 뒤에 줄을 선다.
      if (!isRangedAttack(unit.def)) {
        const dir = unit.owner === 0 ? 1 : -1;
        if (a.melee === null || (unit.x - a.melee) * dir > 0) a.melee = unit.x;
      }
    }

    return [
      { packX: acc[0].n > 0 ? acc[0].sum / acc[0].n : 0, meleeFrontX: acc[0].melee, count: acc[0].n },
      { packX: acc[1].n > 0 ? acc[1].sum / acc[1].n : 0, meleeFrontX: acc[1].melee, count: acc[1].n },
    ];
  }

  private stepUnits(dt: number): void {
    const dead: FakeUnit[] = [];
    const packs = this.computePacks();

    for (const unit of this.units) {
      const dir = unit.owner === 0 ? 1 : -1;
      unit.facing = dir;
      unit.attackCdMs = Math.max(0, unit.attackCdMs - TICK_MS);
      unit.castMs = Math.max(0, unit.castMs - TICK_MS);

      if (unit.castMs > 0) {
        unit.state = 'cast';
        continue;
      }

      const target = this.nearestEnemy(unit, dir);
      const enemyBaseX = unit.owner === 0 ? LOGICAL_MAX : 0;
      const reach = unit.def.range + CONTACT_PAD;
      const baseReach = Math.max(reach, BASE_EDGE_REACH);

      if (target && Math.abs(target.x - unit.x) <= reach) {
        unit.state = 'attack';
        if (unit.attackCdMs === 0) {
          const killed = this.performAttack(unit, target);
          if (killed) dead.push(killed);
        }
      } else if (!target && Math.abs(enemyBaseX - unit.x) <= baseReach) {
        unit.state = 'attack';
        if (unit.attackCdMs === 0) {
          const victim: PlayerId = unit.owner === 0 ? 1 : 0;
          this.performAttack(unit, undefined, victim);
        }
      } else if (this.blockedByAlly(unit, dir)) {
        unit.state = 'idle';
      } else {
        const pack = packs[unit.owner];
        const gaps = this.neighborGaps(unit, dir);

        // 원거리는 근접 벽을 앞지르지 않는다 — 혼자 걸어 나가 1:1로 죽는 걸 막고,
        // 사거리가 비슷한 유닛끼리 같은 x 띠에 모여 함께 사격하게 된다.
        //
        // 단, 벽이 **내 앞에 있을 때만** 적용한다. 근접이 전멸했거나 아직 뒤에서
        // 올라오는 중이면 멈춰 세우지 않는다 — 그러면 전진이 영구히 막힌다.
        const wallAhead =
          isRangedAttack(unit.def) &&
          pack.meleeFrontX !== null &&
          (pack.meleeFrontX - unit.x) * dir > 0;
        const holdX = wallAhead ? (pack.meleeFrontX as number) - dir * RANGED_HOLD_MIN : null;

        if (holdX !== null && (unit.x - holdX) * dir >= 0) {
          unit.state = 'idle';
        } else if (
          gaps.behind > MUSTER_GAP &&
          gaps.behind <= COHESION_WINDOW &&
          unit.musterMs < MUSTER_MAX_MS
        ) {
          // 바로 뒤 아군이 뒤처졌으면 기다린다 (각개전투 방지).
          // 간격이 COHESION_WINDOW를 넘으면 본대가 아니라 먼 증원이므로 기다리지 않는다.
          // 대기에는 상한이 있다 — 없으면 생산이 계속되는 동안 선두가 영구히 멈춘다.
          unit.musterMs += TICK_MS;
          unit.state = 'idle';
        } else {
          unit.musterMs = 0;
          unit.state = 'move';
          // 앞 아군과 벌어졌으면 가속해 합류한다 → 줄이 아니라 덩어리로 움직인다.
          // 상한(COHESION_WINDOW)은 '기다리기'에만 쓴다 — 추격에 상한을 걸면
          // 멀리 뒤처진 유닛이 가속을 못 받아 오히려 더 벌어진다.
          const chasing = gaps.ahead > MUSTER_GAP;
          const speed = chasing ? unit.def.speed * CATCHUP_SPEED : unit.def.speed;
          unit.x = clamp(unit.x + dir * speed * dt, 0, LOGICAL_MAX);
        }
      }
    }

    this.removeDead(dead);
    this.stepProjectiles();

    for (let i = 0; i < 2; i += 1) {
      if (this.players[i].baseHp <= 0) {
        this.winner = i === 0 ? 1 : 0;
        this.emit({ type: 'gameOver', winner: this.winner });
        return;
      }
    }
  }

  private performAttack(attacker: FakeUnit, target?: FakeUnit, targetOwner?: PlayerId): FakeUnit | undefined {
    attacker.attackCdMs = attacker.def.attackIntervalMs;
    attacker.attackCount += 1;
    const skill = attacker.attackCount % SKILL_EVERY_ATTACKS === 0 && attacker.def.skillIds.length > 0;
    const ranged = isRangedAttack(attacker.def);
    const crit = this.rng() < 0.12;
    const baseDamage = attacker.def.dps * (attacker.def.attackIntervalMs / 1000);
    const damage = Math.max(1, Math.round(baseDamage * (skill ? SKILL_DAMAGE_MULTIPLIER : 1) * (crit ? 2 : 1)));

    if (skill) {
      attacker.state = 'cast';
      attacker.castMs = CAST_MS;
      this.emit({
        type: 'skill',
        unitId: attacker.id,
        defId: attacker.def.id,
        owner: attacker.owner,
        skillId: attacker.def.skillIds[(attacker.attackCount / SKILL_EVERY_ATTACKS - 1) % attacker.def.skillIds.length],
        x: attacker.x,
      });
    }
    this.emit({
      type: 'attack',
      unitId: attacker.id,
      defId: attacker.def.id,
      owner: attacker.owner,
      x: attacker.x,
      ranged,
      skill,
    });

    if (ranged) {
      this.launchProjectile(attacker, damage, crit, skill, target, targetOwner);
      return undefined;
    }
    if (target) return this.damageUnit(target, damage, crit);
    if (targetOwner !== undefined) this.damageBase(targetOwner, damage);
    return undefined;
  }

  private launchProjectile(
    attacker: FakeUnit,
    damage: number,
    crit: boolean,
    skill: boolean,
    target?: FakeUnit,
    targetOwner?: PlayerId,
  ): void {
    const toX = target?.x ?? (targetOwner === 0 ? 0 : LOGICAL_MAX);
    const style = projectileStyleFor(attacker.def, skill);
    this.projectiles.push({
      id: this.nextProjectileId++,
      defId: attacker.def.id,
      owner: attacker.owner,
      sourceUnitId: attacker.id,
      ...(target ? { targetUnitId: target.id } : {}),
      ...(targetOwner !== undefined ? { targetOwner } : {}),
      fromX: attacker.x,
      toX,
      elapsedMs: 0,
      durationMs: projectileDurationMs(toX - attacker.x, style),
      damage,
      crit,
      style,
    });
  }

  private stepProjectiles(): void {
    const completed: FakeProjectile[] = [];
    const dead: FakeUnit[] = [];

    for (const projectile of this.projectiles) {
      projectile.elapsedMs += TICK_MS;
      if (projectile.elapsedMs < projectile.durationMs) continue;
      completed.push(projectile);

      if (projectile.targetUnitId !== undefined) {
        const target = this.units.find((unit) => unit.id === projectile.targetUnitId && unit.hp > 0);
        if (target) {
          const killed = this.damageUnit(target, projectile.damage, projectile.crit);
          if (killed) dead.push(killed);
        }
      } else if (projectile.targetOwner !== undefined) {
        this.damageBase(projectile.targetOwner, projectile.damage);
      }
    }

    if (completed.length > 0) {
      this.projectiles = this.projectiles.filter((projectile) => !completed.includes(projectile));
    }
    this.removeDead(dead);
  }

  private damageUnit(target: FakeUnit, rawAmount: number, crit: boolean): FakeUnit | undefined {
    const blocked = this.rng() < blockChanceFor(target.def);
    const amount = Math.max(1, Math.round(rawAmount * (blocked ? BLOCKED_DAMAGE_MULTIPLIER : 1)));
    target.hp -= amount;
    this.emit({ type: 'hit', unitId: target.id, x: target.x, amount, crit, blocked });
    if (target.hp > 0) return undefined;
    target.state = 'die';
    return target;
  }

  private damageBase(owner: PlayerId, amount: number): void {
    this.players[owner].baseHp = Math.max(0, this.players[owner].baseHp - amount);
    this.emit({ type: 'baseHit', owner, amount });
  }

  private removeDead(dead: readonly FakeUnit[]): void {
    if (dead.length === 0) return;
    const unique = new Set(dead);
    for (const unit of unique) {
      this.emit({ type: 'kill', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x });
    }
    this.units = this.units.filter((unit) => !unique.has(unit));
  }

  private nearestEnemy(unit: FakeUnit, dir: 1 | -1): FakeUnit | null {
    let best: FakeUnit | null = null;
    let bestDist = Infinity;
    for (const other of this.units) {
      if (other.owner === unit.owner || other.hp <= 0) continue;
      const delta = (other.x - unit.x) * dir;
      if (delta < -CONTACT_PAD) continue; // 이미 지나친 적은 무시
      if (delta < bestDist) {
        bestDist = delta;
        best = other;
      }
    }
    return best;
  }

  /**
   * 같은 진영에서 내 앞/뒤로 가장 가까운 아군까지의 거리. 없으면 Infinity.
   * dir 방향이 '앞'이다.
   */
  private neighborGaps(unit: FakeUnit, dir: 1 | -1): { ahead: number; behind: number } {
    let ahead = Infinity;
    let behind = Infinity;
    for (const other of this.units) {
      if (other === unit || other.owner !== unit.owner || other.hp <= 0) continue;
      const delta = (other.x - unit.x) * dir;
      if (delta > 0) {
        if (delta < ahead) ahead = delta;
      } else if (delta < 0) {
        if (-delta < behind) behind = -delta;
      }
    }
    return { ahead, behind };
  }

  /** 앞선 아군과 최소 간격 유지 — 완전히 포개지는 것만 막고, 촘촘히 뭉치는 건 허용한다. */
  private blockedByAlly(unit: FakeUnit, dir: 1 | -1): boolean {
    for (const other of this.units) {
      if (other === unit || other.owner !== unit.owner) continue;
      const delta = (other.x - unit.x) * dir;
      if (delta > 0 && delta < ALLY_SPACING && other.state !== 'move') return true;
    }
    return false;
  }

  // -- 스냅샷 --------------------------------------------------------------

  private buildSnapshot(): Snapshot {
    const units: UnitSnapshot[] = this.units.map((u) => ({
      id: u.id,
      defId: u.def.id,
      owner: u.owner,
      tier: u.def.tier,
      x: u.x,
      hp: Math.max(0, u.hp),
      maxHp: u.def.hp,
      state: u.state,
      facing: u.facing,
    }));

    return {
      tick: this.tick,
      elapsedMs: this.tick * TICK_MS,
      units,
      projectiles: this.projectiles.map((projectile) => {
        const progress = Math.min(1, projectile.elapsedMs / projectile.durationMs);
        return {
          id: projectile.id,
          defId: projectile.defId,
          owner: projectile.owner,
          sourceUnitId: projectile.sourceUnitId,
          ...(projectile.targetUnitId !== undefined ? { targetUnitId: projectile.targetUnitId } : {}),
          fromX: projectile.fromX,
          toX: projectile.toX,
          x: projectile.fromX + (projectile.toX - projectile.fromX) * progress,
          style: projectile.style,
          progress,
        };
      }),
      players: [this.snapshotPlayer(0), this.snapshotPlayer(1)],
      me: this.me,
      phase: this.winner === null ? 'playing' : 'over',
      ...(this.winner === null ? {} : { winner: this.winner }),
    };
  }

  private snapshotPlayer(owner: PlayerId): PlayerSnapshot {
    const p = this.players[owner];
    return {
      cash: Math.floor(p.cash),
      supply: this.supplyOf(owner),
      supplyMax: this.balance.supplyMax,
      age: p.age,
      baseHp: p.baseHp,
      baseMaxHp: this.balance.baseHp,
      cooldowns: { ...p.cooldowns },
      unlockedTiers: [...p.unlockedTiers],
      queue: p.queue.map((q, i) => ({
        defId: q.def.id,
        progress: i === 0 ? q.elapsedMs / q.def.buildMs : 0,
      })),
    };
  }

  private makePlayer(): FakePlayer {
    return {
      cash: 300,
      age: 0,
      baseHp: this.balanceBaseHp(),
      cooldowns: {},
      unlockedTiers: unlockedForAge(0),
      queue: [],
    };
  }

  private balanceBaseHp(): number {
    // constructor에서 this.balance 할당 전에 호출되지 않도록 makePlayer는 그 뒤에서만 쓴다.
    return this.balance.baseHp;
  }

  private emit(event: SimEvent): void {
    this.pending.push(event);
  }

  private flush(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    for (const cb of this.listeners) cb(batch);
  }
}

function unlockedForAge(age: number): number[] {
  const max = Math.min(9, 3 + age * 2);
  return Array.from({ length: max }, (_, i) => i + 1);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
