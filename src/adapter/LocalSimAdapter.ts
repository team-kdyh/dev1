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
import { FACTION_OF_PLAYER, unitsOfFaction } from '../data/gameData';
import { createInitialMemory, evaluateAi, defaultCatalog } from '../ai/index';
import type { AiMemory, Command as AiCommand, DifficultyId, SimulationSnapshot as AiSnapshot, UnitRole } from '../ai/types';
import { FixedStepLoop, LOGICAL_MAX, TICK_MS, type SimAdapter } from './SimAdapter';

/** Browser implementation of Track B's 30 Hz M0 rules, consuming Track C data. */

interface SimUnit {
  id: number;
  def: UnitDef;
  owner: PlayerId;
  x: number;
  hp: number;
  maxHp: number;
  state: UnitState;
  facing: 1 | -1;
  attackCdMs: number;
  poseMs: number;
  healCdMs: number;
  /** 뒤를 기다린 누적 시간 — 상한을 넘으면 그냥 전진한다 */
  musterMs: number;
}

interface SimPlayer {
  cash: number;
  cumulativeCash: number;
  age: number;
  ageEnteredTick: number;
  baseHp: number;
  baseMaxHp: number;
  cooldowns: Record<string, number>;
  strategyCooldowns: Record<string, number>;
  upgradeLevels: Record<string, number>;
  cashBoostMs: number;
  turretCdMs: number;
  instantProductionCharges: number;
  unlockedTiers: number[];
  queue: { def: UnitDef; elapsedMs: number }[];
}

const CONTACT_PAD = 8;

// --- 본대 대열 (각개전투 방지) --------------------------------------------
// 유닛이 한 기씩 도착해 1:1로 싸우는 걸 막는다.

/** 바로 뒤 아군과 이만큼 넘게 벌어지면 기다린다. */
const MUSTER_GAP = 30;
/** 이 거리 안의 아군만 같은 본대로 본다. 멀리 있는 증원을 기다리다 전진이 멈추지 않게. */
const COHESION_WINDOW = 220;
/**
 * 한 유닛이 뒤를 기다릴 수 있는 최대 시간.
 * 상한이 없으면 교착된다 — 생산이 계속되는 동안 선두 뒤에는 항상 새 낙오자가
 * 생기므로 선두가 영구히 멈춰 서고 양측이 아예 만나지 못한다.
 */
const MUSTER_MAX_MS = 1200;
/** 뒤처진 유닛의 가속 배율 */
const CATCHUP_SPEED = 1.6;
/** 원거리 유닛이 근접 벽 뒤에 유지하는 거리 */
const RANGED_HOLD_MIN = 26;
/** 이 사거리 이상이면 대열상 '원거리'로 본다 */
const RANGED_MIN_RANGE = 50;

/** 대열상 원거리 유닛인가. damageType이 optional이라 사거리도 같이 본다. */
function isRangedFormation(def: UnitDef): boolean {
  return def.damageType !== 'melee' && def.range >= RANGED_MIN_RANGE;
}

export interface LocalMatchOptions {
  me?: PlayerId;
  difficulty?: DifficultyId;
  startCash?: number;
  baseHp?: number;
  enemyBaseHp?: number;
  timeLimitSeconds?: number;
  startAge?: number;
  bannedUnits?: readonly string[];
  research?: Readonly<Record<string, number>>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class LocalSimAdapter implements SimAdapter {
  private readonly loop: FixedStepLoop;
  private readonly rng: () => number;
  private readonly balance: BalanceData;
  private readonly me: PlayerId;

  private tick = 0;
  private nextUnitId = 1;
  private units: SimUnit[] = [];
  private players: [SimPlayer, SimPlayer];
  private aiMemory: AiMemory = createInitialMemory();
  private readonly scheduled: { tick: number; owner: PlayerId; command: Command }[] = [];
  private winner: PlayerId | null = null;

  private pending: SimEvent[] = [];
  private listeners: ((events: SimEvent[]) => void)[] = [];

  // 직전 스냅샷은 프론트가 §2.2대로 직접 보관한다 — 시뮬은 현재 것만 들고 있으면 된다.
  private currSnapshot: Snapshot;

  constructor(balance: BalanceData, seed = 1337, private readonly options: LocalMatchOptions = {}) {
    this.balance = balance;
    this.me = options.me ?? 0;
    this.rng = mulberry32(seed);
    this.players = [this.makePlayer(0), this.makePlayer(1)];
    this.loop = new FixedStepLoop(TICK_MS, () => this.step());
    this.currSnapshot = this.buildSnapshot();
    // 첫 교전이 본진 앞에서 시작되지 않도록 AI도 가장 기본 유닛을 즉시 생산한다.
    // 이후 생산·업그레이드·전략은 Track C AI가 그대로 결정한다.
    const enemy: PlayerId = this.me === 0 ? 1 : 0;
    const opener = unitsOfFaction(balance, FACTION_OF_PLAYER[enemy])
      .find((unit) => unit.tier === 1 && !options.bannedUnits?.includes(unit.id));
    if (opener && this.players[enemy].cash >= opener.cost) {
      this.scheduled.push({ tick: 1, owner: enemy, command: { type: 'SPAWN_UNIT', defId: opener.id } });
    }
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

  /** Headless checks use the same fixed step as the browser loop. */
  advanceTicks(count: number): void {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('count must be a nonnegative integer');
    for (let index = 0; index < count; index++) this.step();
  }

  onEvents(cb: (events: SimEvent[]) => void): void {
    this.listeners.push(cb);
  }

  setTimeScale(scale: number): void {
    this.loop.timeScale = scale;
  }

  send(cmd: Command): void {
    this.enqueue(this.me, cmd);
  }

  private enqueue(owner: PlayerId, command: Command): void {
    this.scheduled.push({ tick: this.tick + 2, owner, command });
  }

  private applyCommand(owner: PlayerId, cmd: Command): void {
    const player = this.players[owner];
    if (this.winner !== null) {
      this.emit({ type: 'rejected', owner, command: cmd, reason: 'GAME_OVER' });
      return;
    }
    switch (cmd.type) {
      case 'SPAWN_UNIT': {
        const def = this.balance.units.find((u) => u.id === cmd.defId);
        if (!def || def.faction !== FACTION_OF_PLAYER[owner]) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'LOCKED' });
          return;
        }
        const reason = this.rejectSpawn(owner, def);
        if (reason) {
          this.emit({ type: 'rejected', owner, command: cmd, reason });
          return;
        }
        player.cash -= def.cost;
        const logistics = player.upgradeLevels.logistics ?? 0;
        const cooldown = Math.max(200, def.cooldownMs * (1 - 0.2 * logistics));
        player.cooldowns[def.id] = player.instantProductionCharges > 0 ? 0 : cooldown;
        if (player.instantProductionCharges > 0) player.instantProductionCharges--;
        player.queue.push({ def, elapsedMs: 0 });
        break;
      }
      case 'CANCEL_QUEUE': {
        const item = player.queue[cmd.index];
        if (!item) return;
        player.queue.splice(cmd.index, 1);
        player.cash = Math.min(this.balance.cashCap ?? 9999, player.cash + Math.floor(item.def.cost * 0.8));
        break;
      }
      case 'AGE_UP': {
        const next = this.balance.ages?.find((age) => age.age === player.age + 1);
        if (!next || player.cumulativeCash < next.cumulativeCashRequired ||
            (next.previousAgeSecondsRequired !== undefined &&
              this.tick - player.ageEnteredTick < next.previousAgeSecondsRequired * 30)) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'LOCKED' });
          return;
        }
        if (player.cash < next.cost) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'NO_CASH' });
          return;
        }
        player.cash -= next.cost;
        player.age = next.age;
        player.ageEnteredTick = this.tick;
        player.unlockedTiers = this.unlockedForAge(player.age);
        this.emit({ type: 'ageup', owner, age: player.age });
        break;
      }
      case 'USE_STRATEGY': {
        const choice = this.balance.strategies?.filter((item) => item.faction === FACTION_OF_PLAYER[owner])[cmd.slot];
        if (!choice) return;
        if ((player.strategyCooldowns[choice.id] ?? 0) > 0) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'COOLDOWN' });
          return;
        }
        player.strategyCooldowns[choice.id] = choice.cooldownMs;
        if (choice.id === 'fast_charge') player.cashBoostMs = 5000;
        if (choice.id === 'mass_production') player.instantProductionCharges = 3;
        if (choice.id === 'ota_update') {
          for (const unit of this.units) {
            if (unit.owner === owner) unit.hp = Math.min(unit.maxHp, unit.hp + unit.maxHp * 0.3);
          }
        }
        if (choice.id === 'airdrop') {
          const unit = this.units.find((item) => item.owner === owner);
          const front = this.units.reduce((value, item) =>
            item.owner === owner ? (owner === 0 ? Math.max(value, item.x) : Math.min(value, item.x)) : value,
            owner === 0 ? 60 : 940);
          if (unit) unit.x = Math.max(30, Math.min(970, front + (owner === 0 ? -20 : 20)));
        }
        this.emit({ type: 'strategy', owner, slot: cmd.slot, strategyId: choice.id });
        break;
      }
      case 'BUY_UPGRADE': {
        const upgrade = this.balance.upgrades?.find((item) => item.id === cmd.upgradeId);
        if (!upgrade) return;
        const level = player.upgradeLevels[upgrade.id] ?? 0;
        const cost = upgrade.costs[level];
        if (cost === undefined || level >= upgrade.maxLevel) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'LOCKED' });
          return;
        }
        if (player.cash < cost) {
          this.emit({ type: 'rejected', owner, command: cmd, reason: 'NO_CASH' });
          return;
        }
        player.cash -= cost;
        player.upgradeLevels[upgrade.id] = level + 1;
        if (upgrade.id === 'quality_control') {
          for (const unit of this.units) {
            if (unit.owner !== owner) continue;
            const extra = unit.def.hp * 0.12;
            unit.maxHp += extra;
            unit.hp += extra;
          }
        }
        break;
      }
    }
  }

  // -- 판정 ----------------------------------------------------------------

  /** 프론트(§4.1)와 같은 규칙. 어긋나면 버그라는 걸 증명하기 위해 일부러 중복 구현. */
  private rejectSpawn(owner: PlayerId, def: UnitDef): RejectReason | null {
    const p = this.players[owner];
    if (this.winner !== null) return 'GAME_OVER';
    if (!p.unlockedTiers.includes(def.tier) || this.options.bannedUnits?.includes(def.id)) return 'LOCKED';
    if (p.queue.length >= this.balance.queueMax) return 'QUEUE_FULL';
    if ((p.cooldowns[def.id] ?? 0) > 0) return 'COOLDOWN';
    if (p.cash < def.cost) return 'NO_CASH';
    if (this.supplyOf(owner) + def.supply > this.supplyCap(owner)) return 'NO_SUPPLY';
    return null;
  }

  private supplyOf(owner: PlayerId): number {
    let total = 0;
    for (const u of this.units) if (u.owner === owner) total += u.def.supply;
    for (const q of this.players[owner].queue) total += q.def.supply;
    return total;
  }

  private supplyCap(owner: PlayerId): number {
    return Math.min(18, this.balance.supplyMax + 3 * (this.players[owner].upgradeLevels.expansion ?? 0));
  }

  private unlockedForAge(age: number): number[] {
    return this.balance.ages?.filter((entry) => entry.age <= age).flatMap((entry) => [...entry.tiers]) ?? [1, 2, 3];
  }

  // -- 시뮬 루프 -----------------------------------------------------------

  private step(): void {
    if (this.winner !== null) {
      this.flush();
      return;
    }

    this.tick += 1;
    const dt = TICK_MS / 1000;
    for (let index = 0; index < this.scheduled.length;) {
      const task = this.scheduled[index];
      if (task.tick > this.tick) { index++; continue; }
      this.scheduled.splice(index, 1);
      this.applyCommand(task.owner, task.command);
    }

    for (let i = 0; i < 2; i += 1) {
      const p = this.players[i];
      const researchCash = i === this.me ? 0.5 * (this.options.research?.[FACTION_OF_PLAYER[i] + '_cash_rate'] ?? 0) : 0;
      const income = (this.balance.cashPerSecond + researchCash + 3 * (p.upgradeLevels.production_line ?? 0)) *
        (p.cashBoostMs > 0 ? 3 : 1) * dt;
      p.cash = Math.min(this.balance.cashCap ?? 9999, p.cash + income);
      p.cumulativeCash += income;
      p.cashBoostMs = Math.max(0, p.cashBoostMs - TICK_MS);
      p.turretCdMs = Math.max(0, p.turretCdMs - TICK_MS);
      for (const key of Object.keys(p.cooldowns)) {
        p.cooldowns[key] = Math.max(0, p.cooldowns[key] - TICK_MS);
      }
      for (const key of Object.keys(p.strategyCooldowns)) {
        p.strategyCooldowns[key] = Math.max(0, p.strategyCooldowns[key] - TICK_MS);
      }
      this.stepQueue(i as PlayerId, p);
    }

    this.stepUnits(dt);
    if (this.winner === null) this.stepTurrets();

    this.currSnapshot = this.buildSnapshot();
    this.stepAi();
    this.flush();
  }

  private stepQueue(owner: PlayerId, p: SimPlayer): void {
    const head = p.queue[0];
    if (!head) return;
    head.elapsedMs += TICK_MS;
    if (head.elapsedMs < head.def.buildMs) return;
    const spawnX = owner === 0 ? 60 : 940;
    if (this.units.some((unit) => unit.owner === owner && Math.abs(unit.x - spawnX) < 20)) return;
    p.queue.shift();
    this.spawn(owner, head.def);
  }

  private spawn(owner: PlayerId, def: UnitDef): void {
    const x = owner === 0 ? 60 : LOGICAL_MAX - 60;
    const mastery = owner === this.me ? this.options.research?.[FACTION_OF_PLAYER[owner] + '_unit_mastery'] ?? 0 : 0;
    const ageBonus = this.balance.ages?.find((age) => age.age === this.players[owner].age);
    const hp = def.hp * (1 + 0.12 * (this.players[owner].upgradeLevels.quality_control ?? 0) +
      0.03 * mastery + (ageBonus?.globalStatBonus ?? 0));
    const unit: SimUnit = {
      id: this.nextUnitId++,
      def,
      owner,
      x,
      hp,
      maxHp: hp,
      state: 'move',
      facing: owner === 0 ? 1 : -1,
      attackCdMs: 0,
      poseMs: 0,
      healCdMs: 1000,
      musterMs: 0,
    };
    this.units.push(unit);
    this.emit({ type: 'spawn', unitId: unit.id, defId: def.id, owner, x });
  }

  private stepAi(): void {
    const snapshot: AiSnapshot = {
      tick: this.tick,
      tickRate: 30,
      laneLength: LOGICAL_MAX,
      players: ([0, 1] as PlayerId[]).map((owner) => {
        const p = this.players[owner];
        return {
          id: owner === 0 ? 'p0' : 'p1',
          faction: FACTION_OF_PLAYER[owner],
          cash: Math.floor(p.cash),
          cashRate: this.balance.cashPerSecond + 3 * (p.upgradeLevels.production_line ?? 0),
          supplyUsed: this.supplyOf(owner),
          supplyCap: this.supplyCap(owner),
          age: p.age,
          ageEnteredTick: p.ageEnteredTick,
          cumulativeCash: p.cumulativeCash,
          baseHp: p.baseHp,
          baseMaxHp: p.baseMaxHp,
          unlockedUnits: unitsOfFaction(this.balance, FACTION_OF_PLAYER[owner])
            .filter((def) => p.unlockedTiers.includes(def.tier)).map((def) => def.id),
          unitCooldowns: { ...p.cooldowns },
          strategyCooldowns: { ...p.strategyCooldowns },
          upgradeLevels: { ...p.upgradeLevels },
          queueSize: p.queue.length,
        };
      }),
      units: this.units.map((unit) => ({
        id: unit.id,
        definitionId: unit.def.id,
        ownerId: unit.owner === 0 ? 'p0' : 'p1',
        x: unit.x,
        hp: unit.hp,
        maxHp: unit.maxHp,
        atk: unit.def.attack ?? unit.def.dps,
        atkSpeed: 1000 / (unit.def.attackIntervalMs ?? 1000),
        roles: [...(unit.def.roles ?? [])] as UnitRole[],
      })),
    } as AiSnapshot;
    const enemy: PlayerId = this.me === 0 ? 1 : 0;
    const result = evaluateAi({
      snapshot, playerId: enemy === 0 ? 'p0' : 'p1', difficulty: this.options.difficulty ?? 'normal',
      catalog: defaultCatalog, memory: this.aiMemory, rng: { next: () => this.rng() },
    });
    this.aiMemory = result.memory;
    if (!result.command) return;
    const command = this.fromAiCommand(result.command, enemy);
    if (command) this.enqueue(enemy, command);
  }

  private fromAiCommand(command: AiCommand, owner: PlayerId): Command | undefined {
    const payload = command.payload;
    switch (command.cmd) {
      case 'SPAWN_UNIT': return { type: 'SPAWN_UNIT', defId: String(payload.unitId) };
      case 'AGE_UP': return { type: 'AGE_UP' };
      case 'BUY_UPGRADE': return { type: 'BUY_UPGRADE', upgradeId: String(payload.upgradeId) };
      case 'USE_STRATEGY': {
        const list = this.balance.strategies?.filter((item) => item.faction === FACTION_OF_PLAYER[owner]) ?? [];
        const index = list.findIndex((item) => item.id === payload.strategyId);
        return index < 0 ? undefined : { type: 'USE_STRATEGY', slot: index as 0 | 1 };
      }
      default: return undefined;
    }
  }

  private stepUnits(dt: number): void {
    const dead: SimUnit[] = [];
    // 가장 앞선 근접 아군(= 벽). 원거리가 이 뒤에 선다.
    const meleeFront = this.meleeFrontByOwner();
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const dir = unit.owner === 0 ? 1 : -1;
      unit.facing = dir;
      unit.attackCdMs = Math.max(0, unit.attackCdMs - TICK_MS);
      unit.poseMs = Math.max(0, unit.poseMs - TICK_MS);
      unit.healCdMs = Math.max(0, unit.healCdMs - TICK_MS);

      if (unit.def.id === 'semicon_t2_watch_medic' && unit.healCdMs === 0) {
        unit.healCdMs = 1000;
        const wounded = this.units.filter((other) => other.owner === unit.owner && other.hp > 0 &&
          other.hp < other.maxHp && Math.abs(other.x - unit.x) <= 100);
        wounded.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp ||
          Math.abs(left.x - unit.x) - Math.abs(right.x - unit.x) || left.id - right.id);
        if (wounded.length > 0) {
          for (const target of wounded.slice(0, 3)) target.hp = Math.min(target.maxHp, target.hp + 6);
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_heart_monitor', x: unit.x });
          unit.state = 'cast';
          unit.poseMs = 330;
        }
      }

      const target = this.nearestEnemy(unit, dir);
      const enemyBaseX = unit.owner === 0 ? LOGICAL_MAX : 0;
      const reach = unit.def.range + CONTACT_PAD;
      const attackInterval = unit.def.attackIntervalMs ?? 1000;
      if (target && Math.abs(target.x - unit.x) <= reach) {
        if (unit.attackCdMs === 0) {
          unit.attackCdMs = attackInterval;
          unit.poseMs = 330;
          unit.state = 'attack';
          this.emit({ type: 'attack', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x, targetX: target.x });
          const victims = [target];
          if (unit.def.targetType === 'splash') {
            const radius = unit.def.splashRadius ?? 0;
            for (const other of this.units) {
              if (other !== target && other.owner !== unit.owner && other.hp > 0 &&
                  Math.abs(other.x - target.x) <= radius) victims.push(other);
            }
          }
          for (const victim of victims) {
            const matrix = this.balance.damageMatrix?.[unit.def.damageType ?? 'melee']?.[victim.def.armorClass ?? 'light'] ?? 1;
            const mastery = unit.owner === this.me ? this.options.research?.[FACTION_OF_PLAYER[unit.owner] + '_unit_mastery'] ?? 0 : 0;
            const ageBonus = this.balance.ages?.find((age) => age.age === this.players[unit.owner].age)?.globalStatBonus ?? 0;
            const attack = (unit.def.attack ?? unit.def.dps) *
              (1 + 0.12 * (this.players[unit.owner].upgradeLevels.rnd ?? 0) + 0.03 * mastery + ageBonus);
            const amount = Math.max(1, Math.round(attack * matrix - (victim.def.armor ?? 0)));
            victim.hp -= amount;
            this.emit({ type: 'hit', unitId: victim.id, x: victim.x, amount, crit: false });
            if (victim.hp <= 0 && !dead.includes(victim)) dead.push(victim);
          }
        } else if (unit.poseMs === 0) unit.state = 'idle';
      } else if (!target && Math.abs(enemyBaseX - unit.x) <= reach) {
        if (unit.attackCdMs === 0) {
          unit.attackCdMs = attackInterval;
          unit.poseMs = 330;
          unit.state = 'attack';
          this.emit({ type: 'attack', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x, targetX: enemyBaseX });
          const victim: PlayerId = unit.owner === 0 ? 1 : 0;
          const matrix = this.balance.damageMatrix?.[unit.def.damageType ?? 'melee']?.structure ?? 1;
          const amount = Math.max(1, Math.round((unit.def.attack ?? unit.def.dps) * matrix));
          this.players[victim].baseHp = Math.max(0, this.players[victim].baseHp - amount);
          this.emit({ type: 'baseHit', owner: victim, amount });
        } else if (unit.poseMs === 0) unit.state = 'idle';
      } else if (this.blockedByAlly(unit, dir)) {
        if (unit.poseMs === 0) unit.state = 'idle';
      } else {
        const gaps = this.neighborGaps(unit, dir);
        const meleeFrontX = meleeFront[unit.owner];

        // 원거리는 근접 벽을 앞지르지 않는다 — 혼자 걸어 나가 1:1로 죽는 걸 막고,
        // 사거리가 비슷한 유닛끼리 같은 x 띠에 모여 함께 사격하게 된다.
        //
        // 벽이 **내 앞에 있을 때만** 적용한다. 근접이 전멸했거나 아직 뒤에서
        // 올라오는 중이면 멈춰 세우지 않는다 — 그러면 전진이 영구히 막힌다.
        const wallAhead =
          isRangedFormation(unit.def) && meleeFrontX !== null && (meleeFrontX - unit.x) * dir > 0;
        const holdX = wallAhead ? (meleeFrontX as number) - dir * RANGED_HOLD_MIN : null;

        if (holdX !== null && (unit.x - holdX) * dir >= 0) {
          if (unit.poseMs === 0) unit.state = 'idle';
        } else if (
          gaps.behind > MUSTER_GAP &&
          gaps.behind <= COHESION_WINDOW &&
          unit.musterMs < MUSTER_MAX_MS
        ) {
          // 바로 뒤 아군이 뒤처졌으면 기다린다 (각개전투 방지).
          // 대기에는 상한이 있다 — 없으면 생산이 계속되는 동안 선두가 영구히 멈추고
          // 양측이 아예 만나지 못한다.
          unit.musterMs += TICK_MS;
          if (unit.poseMs === 0) unit.state = 'idle';
        } else {
          unit.musterMs = 0;
          if (unit.poseMs === 0) unit.state = 'move';
          // 앞 아군과 벌어졌으면 가속해 합류한다 → 줄이 아니라 덩어리로 움직인다.
          // 추격에는 상한을 걸지 않는다 — 걸면 멀리 뒤처진 유닛이 가속을 못 받아 더 벌어진다.
          const speed = gaps.ahead > MUSTER_GAP ? unit.def.speed * CATCHUP_SPEED : unit.def.speed;
          unit.x = clamp(unit.x + dir * speed * dt, 0, LOGICAL_MAX);
        }
      }
    }

    for (const unit of dead) {
      const killer: PlayerId = unit.owner === 0 ? 1 : 0;
      const reward = Math.round(unit.def.cost * 0.4);
      this.players[killer].cash = Math.min(this.balance.cashCap ?? 9999, this.players[killer].cash + reward);
      this.emit({ type: 'kill', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x });
    }
    if (dead.length > 0) this.units = this.units.filter((unit) => !dead.includes(unit));
    for (let owner = 0; owner < 2; owner++) {
      if (this.players[owner].baseHp > 0) continue;
      this.winner = owner === 0 ? 1 : 0;
      this.emit({ type: 'gameOver', winner: this.winner });
      return;
    }
    if (this.tick >= (this.options.timeLimitSeconds ?? 480) * 30) {
      this.winner = this.players[0].baseHp >= this.players[1].baseHp ? 0 : 1;
      this.emit({ type: 'gameOver', winner: this.winner });
    }
  }

  private nearestEnemy(unit: SimUnit, dir: 1 | -1): SimUnit | null {
    const candidates = this.units.filter((other) =>
      other.owner !== unit.owner && other.hp > 0 && (other.x - unit.x) * dir >= -CONTACT_PAD);
    if (candidates.length === 0) return null;
    const reachable = candidates.filter((other) => Math.abs(other.x - unit.x) <= unit.def.range + CONTACT_PAD);
    const pool = reachable.length > 0 ? reachable : candidates;
    pool.sort((left, right) => {
      const a = Math.abs(left.x - unit.x);
      const b = Math.abs(right.x - unit.x);
      return (unit.def.targetPolicy === 'farthest' && reachable.length > 0 ? b - a : a - b) || left.id - right.id;
    });
    return pool[0];
  }

  private stepTurrets(): void {
    for (const owner of [0, 1] as const) {
      const player = this.players[owner];
      if (player.turretCdMs > 0) continue;
      const level = player.upgradeLevels.defense_facility ?? 0;
      const dps = this.balance.baseTurretDps?.[Math.min(level, (this.balance.baseTurretDps?.length ?? 1) - 1)] ?? 25;
      const reach = (this.balance.baseTurretRange ?? 180) + level * 30;
      const baseX = owner === 0 ? 0 : LOGICAL_MAX;
      const target = this.units.filter((unit) => unit.owner !== owner && Math.abs(unit.x - baseX) <= reach)
        .sort((left, right) => Math.abs(left.x - baseX) - Math.abs(right.x - baseX) || left.id - right.id)[0];
      if (!target) continue;
      player.turretCdMs = 1000;
      const amount = Math.max(1, Math.round(dps - (target.def.armor ?? 0)));
      target.hp -= amount;
      this.emit({ type: 'hit', unitId: target.id, x: target.x, amount, crit: false });
      if (target.hp <= 0) {
        player.cash = Math.min(this.balance.cashCap ?? 9999, player.cash + Math.round(target.def.cost * 0.4));
        this.emit({ type: 'kill', unitId: target.id, defId: target.def.id, owner: target.owner, x: target.x });
        this.units = this.units.filter((unit) => unit !== target);
      }
    }
  }

  /** 앞선 아군과 겹치지 않게 줄 세우기 — 스프라이트가 포개지는 걸 막는다. */
  /** 진영별 가장 앞선 근접 아군의 x. 없으면 null. */
  private meleeFrontByOwner(): [number | null, number | null] {
    const front: [number | null, number | null] = [null, null];
    for (const unit of this.units) {
      if (unit.hp <= 0 || isRangedFormation(unit.def)) continue;
      const dir = unit.owner === 0 ? 1 : -1;
      const current = front[unit.owner];
      if (current === null || (unit.x - current) * dir > 0) front[unit.owner] = unit.x;
    }
    return front;
  }

  /**
   * 같은 진영에서 내 앞/뒤로 가장 가까운 아군까지의 거리. 없으면 Infinity.
   * dir 방향이 '앞'이다.
   */
  private neighborGaps(unit: SimUnit, dir: 1 | -1): { ahead: number; behind: number } {
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

  private blockedByAlly(unit: SimUnit, dir: 1 | -1): boolean {
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
      maxHp: u.maxHp,
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
      supplyMax: this.supplyCap(owner),
      age: p.age,
      baseHp: p.baseHp,
      baseMaxHp: p.baseMaxHp,
      cooldowns: { ...p.cooldowns },
      strategyCooldowns: { ...p.strategyCooldowns },
      upgradeLevels: { ...p.upgradeLevels },
      cumulativeCash: p.cumulativeCash,
      ageEnteredTick: p.ageEnteredTick,
      unlockedTiers: [...p.unlockedTiers],
      queue: p.queue.map((q, i) => ({
        defId: q.def.id,
        progress: i === 0 ? Math.min(1, q.elapsedMs / q.def.buildMs) : 0,
      })),
    };
  }

  private makePlayer(owner: PlayerId): SimPlayer {
    const faction = FACTION_OF_PLAYER[owner];
    const research = owner === this.me ? this.options.research : undefined;
    const capitalLevel = research?.[faction + '_initial_capital'] ?? 0;
    const capital = capitalLevel * (capitalLevel + 1) * 25;
    const initialCash = ((owner === this.me ? this.options.startCash : undefined) ?? this.balance.startCash ?? 300) + capital;
    const baseHp = (owner === this.me ? this.options.baseHp : this.options.enemyBaseHp) ?? this.balance.baseHp;
    const baseMaxHp = baseHp + 300 * (research?.[faction + '_base_fortify'] ?? 0);
    const age = owner === this.me ? this.options.startAge ?? 1 : 1;
    return {
      cash: initialCash,
      cumulativeCash: initialCash,
      age,
      ageEnteredTick: 0,
      baseHp: baseMaxHp,
      baseMaxHp,
      cooldowns: {},
      strategyCooldowns: {},
      upgradeLevels: {},
      cashBoostMs: 0,
      turretCdMs: 0,
      instantProductionCharges: 0,
      unlockedTiers: this.unlockedForAge(age),
      queue: [],
    };
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
