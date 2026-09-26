import type {
  BalanceData,
  Command,
  PlayerId,
  PlayerSnapshot,
  RejectReason,
  SimEvent,
  Snapshot,
  UnitDef,
  UnitSnapshot,
  UnitState,
} from '../sim/contracts';
import { FACTION_OF_PLAYER, unitsOfFaction } from '../data/placeholderBalance';
import { FixedStepLoop, LOGICAL_MAX, TICK_MS, type SimAdapter } from './SimAdapter';

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
}

interface FakePlayer {
  cash: number;
  age: number;
  baseHp: number;
  cooldowns: Record<string, number>;
  unlockedTiers: number[];
  queue: { def: UnitDef; elapsedMs: number }[];
}

const ATTACK_INTERVAL_MS = 600;
const CONTACT_PAD = 8;
const AI_SPAWN_INTERVAL_MS = 2500;

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
  private units: FakeUnit[] = [];
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
    this.loop.timeScale = scale;
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
      p.cash += this.balance.cashPerSecond * dt;
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

  private stepUnits(dt: number): void {
    const dead: FakeUnit[] = [];

    for (const unit of this.units) {
      const dir = unit.owner === 0 ? 1 : -1;
      unit.facing = dir;
      unit.attackCdMs = Math.max(0, unit.attackCdMs - TICK_MS);

      const target = this.nearestEnemy(unit, dir);
      const enemyBaseX = unit.owner === 0 ? LOGICAL_MAX : 0;
      const reach = unit.def.range + CONTACT_PAD;

      if (target && Math.abs(target.x - unit.x) <= reach) {
        unit.state = 'attack';
        if (unit.attackCdMs === 0) {
          unit.attackCdMs = ATTACK_INTERVAL_MS;
          const crit = this.rng() < 0.12;
          const amount = Math.round(unit.def.dps * (ATTACK_INTERVAL_MS / 1000) * (crit ? 2 : 1));
          target.hp -= amount;
          this.emit({ type: 'hit', unitId: target.id, x: target.x, amount, crit });
          if (target.hp <= 0 && !dead.includes(target)) {
            target.state = 'die';
            dead.push(target);
          }
        }
      } else if (!target && Math.abs(enemyBaseX - unit.x) <= reach) {
        unit.state = 'attack';
        if (unit.attackCdMs === 0) {
          unit.attackCdMs = ATTACK_INTERVAL_MS;
          const victim: PlayerId = unit.owner === 0 ? 1 : 0;
          const amount = Math.round(unit.def.dps * (ATTACK_INTERVAL_MS / 1000));
          this.players[victim].baseHp = Math.max(0, this.players[victim].baseHp - amount);
          this.emit({ type: 'baseHit', owner: victim, amount });
        }
      } else if (this.blockedByAlly(unit, dir)) {
        unit.state = 'idle';
      } else {
        unit.state = 'move';
        unit.x = clamp(unit.x + dir * unit.def.speed * dt, 0, LOGICAL_MAX);
      }
    }

    for (const unit of dead) {
      this.emit({ type: 'kill', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x });
    }
    if (dead.length > 0) this.units = this.units.filter((u) => !dead.includes(u));

    for (let i = 0; i < 2; i += 1) {
      if (this.players[i].baseHp <= 0) {
        this.winner = i === 0 ? 1 : 0;
        this.emit({ type: 'gameOver', winner: this.winner });
        return;
      }
    }
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

  /** 앞선 아군과 겹치지 않게 줄 세우기 — 스프라이트가 포개지는 걸 막는다. */
  private blockedByAlly(unit: FakeUnit, dir: 1 | -1): boolean {
    for (const other of this.units) {
      if (other === unit || other.owner !== unit.owner) continue;
      const delta = (other.x - unit.x) * dir;
      if (delta > 0 && delta < 11 && other.state !== 'move') return true;
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
      projectiles: [],
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
