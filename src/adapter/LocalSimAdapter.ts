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
import { FixedStepLoop, LOGICAL_MAX, TICK_HZ, TICK_MS, type SimAdapter } from './SimAdapter';

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
  stationaryMs: number;
  skillCdMs: number;
  speedBoostMs: number;
  rootMs: number;
  specialCdMs: number;
  oneMoreUsed: boolean;
  bossBuffed: boolean;
  freeSupply: boolean;
  attackCount: number;
  killCount: number;
  ringStacks: number;
  foldMs: number;
  folded: boolean;
  deployed: boolean;
  silenceMs: number;
  stunMs: number;
  malfunctionMs: number;
  overheatStacks: number;
  coolingMs: number;
  ghostMs: number;
  illusionMs: number;
  isIllusion: boolean;
  convertedUntilTick: number;
  pairBoosted: boolean;
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
  ultimateBuffMs: number;
  unlockedTiers: number[];
  queue: { def: UnitDef; elapsedMs: number }[];
}

const CONTACT_PAD = 8;

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
  enemyStatMod?: number;
  enemyBossAtSeconds?: number;
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
  /** undefined=진행 중, null=무승부 */
  private winner: PlayerId | null | undefined;

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
    if (this.winner !== undefined) {
      this.emit({ type: 'rejected', owner: this.me, command: cmd, reason: 'GAME_OVER' });
      this.flush();
      return;
    }
    this.enqueue(this.me, cmd);
  }

  private enqueue(owner: PlayerId, command: Command): void {
    this.scheduled.push({ tick: this.tick + 2, owner, command });
  }

  private applyCommand(owner: PlayerId, cmd: Command): void {
    const player = this.players[owner];
    if (this.winner !== undefined) {
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
    if (this.winner !== undefined) return 'GAME_OVER';
    if (!p.unlockedTiers.includes(def.tier) || this.options.bannedUnits?.includes(def.id)) return 'LOCKED';
    if (p.queue.length >= this.balance.queueMax) return 'QUEUE_FULL';
    if ((p.cooldowns[def.id] ?? 0) > 0) return 'COOLDOWN';
    if (p.cash < def.cost) return 'NO_CASH';
    if (this.supplyOf(owner) + def.supply > this.supplyCap(owner)) return 'NO_SUPPLY';
    return null;
  }

  private supplyOf(owner: PlayerId): number {
    let total = 0;
    for (const u of this.units) if (u.owner === owner && !u.freeSupply) total += u.def.supply;
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
    if (this.winner !== undefined) {
      this.flush();
      return;
    }

    this.tick += 1;
    const dt = TICK_MS / 1000;
    for (let index = 0; index < this.scheduled.length;) {
      const task = this.scheduled[index];
      if (!task) break;
      if (task.tick > this.tick) { index++; continue; }
      this.scheduled.splice(index, 1);
      this.applyCommand(task.owner, task.command);
    }

    for (const owner of [0, 1] as const) {
      const p = this.players[owner];
      const researchCash = owner === this.me ? 0.5 * (this.options.research?.[FACTION_OF_PLAYER[owner] + '_cash_rate'] ?? 0) : 0;
      const income = (this.balance.cashPerSecond + researchCash + 3 * (p.upgradeLevels.production_line ?? 0)) *
        (p.cashBoostMs > 0 ? 3 : 1) * dt;
      p.cash = Math.min(this.balance.cashCap ?? 9999, p.cash + income);
      p.cumulativeCash += income;
      p.cashBoostMs = Math.max(0, p.cashBoostMs - TICK_MS);
      p.ultimateBuffMs = Math.max(0, p.ultimateBuffMs - TICK_MS);
      p.turretCdMs = Math.max(0, p.turretCdMs - TICK_MS);
      for (const key of Object.keys(p.cooldowns)) {
        p.cooldowns[key] = Math.max(0, (p.cooldowns[key] ?? 0) - TICK_MS);
      }
      for (const key of Object.keys(p.strategyCooldowns)) {
        p.strategyCooldowns[key] = Math.max(0, (p.strategyCooldowns[key] ?? 0) - TICK_MS);
      }
      this.stepQueue(owner, p);
    }

    if (this.options.enemyBossAtSeconds !== undefined &&
      this.tick === Math.round(this.options.enemyBossAtSeconds * 30)) {
      const enemy: PlayerId = this.me === 0 ? 1 : 0;
      const boss = unitsOfFaction(this.balance, FACTION_OF_PLAYER[enemy])
        .find((unit) => unit.tier === 9);
      if (boss) this.spawn(enemy, boss);
    }

    this.syncSemiconAura();
    this.stepUnits(dt);
    if (this.winner === undefined) this.stepTurrets();

    this.currSnapshot = this.buildSnapshot();
    if (this.winner === undefined) this.stepAi();
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

  private spawn(owner: PlayerId, def: UnitDef,
    options: { x?: number; freeSupply?: boolean; illusion?: boolean } = {}): void {
    const x = options.x ?? (owner === 0 ? 60 : LOGICAL_MAX - 60);
    const mastery = owner === this.me ? this.options.research?.[FACTION_OF_PLAYER[owner] + '_unit_mastery'] ?? 0 : 0;
    const ageBonus = this.balance.ages?.find((age) => age.age === this.players[owner].age);
    const hp = options.illusion ? 1 : def.hp * (1 + 0.12 * (this.players[owner].upgradeLevels.quality_control ?? 0) +
      0.03 * mastery + (ageBonus?.globalStatBonus ?? 0)) * this.enemyModifier(owner);
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
      stationaryMs: 0,
      skillCdMs: def.id === 'semicon_t9_chairman' ? 20000 :
        def.id === 'orchard_t9_founder' ? 18000 :
        def.id === 'orchard_t5_pad_shield' ? 12000 :
        def.id === 'semicon_t8_ai_assistant' ? 10000 :
        def.id === 'orchard_t6_vision' && !options.illusion ? 14000 : 0,
      speedBoostMs: 0,
      rootMs: 0,
      specialCdMs: def.id === 'orchard_t9_founder' ? 40000 :
        def.id === 'semicon_t9_chairman' ? 35000 : 0,
      oneMoreUsed: false,
      bossBuffed: false,
      freeSupply: options.freeSupply ?? false,
      attackCount: 0,
      killCount: 0,
      ringStacks: 0,
      foldMs: def.id === 'semicon_t5_fold' ? 2000 : 0,
      folded: def.id === 'semicon_t5_fold',
      deployed: false,
      silenceMs: 0,
      stunMs: 0,
      malfunctionMs: 0,
      overheatStacks: 0,
      coolingMs: 0,
      ghostMs: def.id === 'orchard_t6_vision' && !options.illusion ? 3000 : 0,
      illusionMs: options.illusion ? 5000 : 0,
      isIllusion: options.illusion ?? false,
      convertedUntilTick: 0,
      pairBoosted: false,
    };
    this.units.push(unit);
    this.emit({ type: 'spawn', unitId: unit.id, defId: def.id, owner, x });
  }

  private enemyModifier(owner: PlayerId): number {
    const value = owner === this.me ? 1 : this.options.enemyStatMod ?? 1;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  /** 회장이 필드에 있는 동안 아군 최대 HP를 올리고, 사망 시 비율을 보존해 되돌린다. */
  private syncSemiconAura(): void {
    const empowered = this.units.some((unit) =>
      unit.owner === 0 && unit.def.id === 'semicon_t9_chairman' && unit.hp > 0);
    for (const unit of this.units) {
      if (unit.owner !== 0 || unit.bossBuffed === empowered) continue;
      const factor = empowered ? 1.2 : 1 / 1.2;
      unit.maxHp *= factor;
      unit.hp = Math.min(unit.maxHp, unit.hp * factor);
      unit.bossBuffed = empowered;
    }
  }

  private attackBonus(unit: SimUnit): number {
    const chairman = unit.owner === 0 && this.units.some((ally) =>
      ally.owner === 0 && ally.def.id === 'semicon_t9_chairman' && ally.hp > 0);
    const extended = this.units.some((ally) => ally !== unit && ally.owner === unit.owner &&
      ally.def.id === 'semicon_t7_book_station' && ally.deployed && ally.hp > 0 &&
      Math.abs(ally.x - unit.x) <= 150);
    return (chairman ? 1.2 : 1) * (this.players[unit.owner].ultimateBuffMs > 0 ? 1.5 : 1) *
      (extended ? 1.15 : 1) * (1 + unit.ringStacks * 0.05) *
      (1 + unit.overheatStacks * 0.08);
  }

  private effectiveRange(unit: SimUnit): number {
    const extended = this.units.some((ally) => ally !== unit && ally.owner === unit.owner &&
      ally.def.id === 'semicon_t7_book_station' && ally.deployed && ally.hp > 0 &&
      Math.abs(ally.x - unit.x) <= 150);
    return unit.def.range + (extended ? 40 : 0);
  }

  /** T1 버즈는 한 몸체로 그려지지만 체력 절반에서 한쪽이 이탈해 공격이 빨라진다. */
  private checkPairLoss(unit: SimUnit): void {
    if (unit.def.id !== 'semicon_t1_buds' || unit.pairBoosted ||
      unit.hp <= 0 || unit.hp > unit.maxHp / 2) return;
    unit.pairBoosted = true;
    this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_buds_pair', x: unit.x });
  }

  private stepAi(): void {
    const enemy: PlayerId = this.me === 0 ? 1 : 0;
    const ai = this.players[enemy];
    const nextAge = this.balance.ages?.find((age) => age.age === ai.age + 1);
    if (nextAge) {
      const baseX = enemy === 0 ? 0 : LOGICAL_MAX;
      const underAttack = this.units.some((unit) => unit.owner === this.me &&
        Math.abs(unit.x - baseX) <= 350);
      const readyToSave = ai.cumulativeCash >= nextAge.cumulativeCashRequired;
      const readyToAdvance = readyToSave && ai.cash >= nextAge.cost &&
        (nextAge.previousAgeSecondsRequired === undefined ||
          this.tick - ai.ageEnteredTick >= nextAge.previousAgeSecondsRequired * 30);
      if (readyToAdvance) {
        if (!this.scheduled.some((task) => task.owner === enemy && task.command.type === 'AGE_UP')) {
          this.enqueue(enemy, { type: 'AGE_UP' });
        }
        return;
      }
      if (readyToSave && !underAttack) {
        return;
      }
    }
    // 하드 AI는 저티어 근접 유닛만 반복 생산하지 않고, 전선이 형성되면
    // T3 원거리 유닛의 비용을 모아 혼합 편성을 만든다.
    if ((this.options.difficulty === 'hard' || this.options.difficulty === 'expert') &&
      this.tick >= 300 && ai.age === 1) {
      const ranged = this.balance.units.find((unit) =>
        unit.faction === FACTION_OF_PLAYER[enemy] && unit.tier === 3);
      if (ranged) {
        if (ai.cash < ranged.cost) return;
        if (this.tick % 15 === 0 && !this.rejectSpawn(enemy, ranged) && !this.scheduled.some((task) =>
          task.owner === enemy && task.command.type === 'SPAWN_UNIT' && task.command.defId === ranged.id)) {
          this.enqueue(enemy, { type: 'SPAWN_UNIT', defId: ranged.id });
          return;
        }
        if (!this.rejectSpawn(enemy, ranged)) return;
      }
    }
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
        atk: (unit.def.attack ?? unit.def.dps) * this.enemyModifier(unit.owner),
        atkSpeed: 1000 / (unit.def.attackIntervalMs ?? 1000),
        roles: [...(unit.def.roles ?? [])] as UnitRole[],
      })),
    } as AiSnapshot;
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
    const vanished: SimUnit[] = [];
    const killerById = new Map<number, SimUnit>();
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      if (unit.convertedUntilTick > 0 && this.tick >= unit.convertedUntilTick) {
        vanished.push(unit);
        continue;
      }
      if (unit.isIllusion) {
        unit.illusionMs -= TICK_MS;
        if (unit.illusionMs <= 0) vanished.push(unit);
        else unit.state = 'idle';
        continue;
      }
      const dir = unit.owner === 0 ? 1 : -1;
      unit.facing = dir;
      unit.attackCdMs = Math.max(0, unit.attackCdMs - TICK_MS);
      unit.poseMs = Math.max(0, unit.poseMs - TICK_MS);
      unit.healCdMs = Math.max(0, unit.healCdMs - TICK_MS);
      unit.skillCdMs = Math.max(0, unit.skillCdMs - TICK_MS);
      unit.speedBoostMs = Math.max(0, unit.speedBoostMs - TICK_MS);
      unit.rootMs = Math.max(0, unit.rootMs - TICK_MS);
      unit.specialCdMs = Math.max(0, unit.specialCdMs - TICK_MS);
      unit.silenceMs = Math.max(0, unit.silenceMs - TICK_MS);
      unit.stunMs = Math.max(0, unit.stunMs - TICK_MS);
      unit.malfunctionMs = Math.max(0, unit.malfunctionMs - TICK_MS);
      unit.coolingMs = Math.max(0, unit.coolingMs - TICK_MS);
      unit.ghostMs = Math.max(0, unit.ghostMs - TICK_MS);
      if (unit.def.id === 'semicon_t5_fold') {
        unit.foldMs -= TICK_MS;
        if (unit.foldMs <= 0) {
          unit.foldMs = 2000;
          unit.folded = !unit.folded;
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_fold_toggle', x: unit.x });
        }
      }
      if (unit.stunMs > 0) {
        unit.state = 'idle';
        continue;
      }

      if (unit.def.id === 'semicon_t9_chairman' && unit.skillCdMs === 0 && unit.silenceMs === 0) {
        unit.skillCdMs = 20000;
        const soldier = this.balance.units.find((def) => def.id === 'semicon_t3_aphone');
        if (soldier) {
          for (let index = 0; index < 4; index++) {
            this.spawn(unit.owner, soldier, { x: 60 - index * 14, freeSupply: true });
          }
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_increase_production', x: unit.x });
        }
      }
      if (unit.def.id === 'semicon_t9_chairman' && unit.specialCdMs === 0 && unit.silenceMs === 0) {
        const acquired = this.units.filter((enemy) => enemy.owner !== unit.owner && enemy.hp > 0 &&
          enemy.def.tier < 9 && !enemy.isIllusion &&
          Math.abs(enemy.x - unit.x) <= this.effectiveRange(unit))
          .sort((a, b) => (b.def.attack ?? b.def.dps) * b.maxHp -
            (a.def.attack ?? a.def.dps) * a.maxHp || a.id - b.id)[0];
        if (acquired) {
          acquired.owner = unit.owner;
          acquired.facing = unit.facing;
          acquired.freeSupply = true;
          acquired.convertedUntilTick = this.tick + 8 * TICK_HZ;
          unit.specialCdMs = 35000;
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_acquisition', x: unit.x });
        }
      }
      if (unit.def.id === 'orchard_t6_vision' && unit.skillCdMs === 0 && unit.silenceMs === 0) {
        unit.skillCdMs = 14000;
        for (const offset of [-12, 12]) {
          this.spawn(unit.owner, unit.def, {
            x: clamp(unit.x + offset, 0, LOGICAL_MAX), freeSupply: true, illusion: true,
          });
        }
        this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_illusion', x: unit.x });
      }
      if (unit.def.id === 'orchard_t9_founder' && unit.silenceMs === 0) {
        if (unit.skillCdMs === 0) {
          const rooted = this.units.filter((enemy) => enemy.owner !== unit.owner && enemy.hp > 0 &&
            (enemy.x - unit.x) * dir >= 0 && Math.abs(enemy.x - unit.x) <= 300);
          if (rooted.length > 0) {
            for (const enemy of rooted) enemy.rootMs = Math.max(enemy.rootMs, 3000);
            unit.skillCdMs = 18000;
            this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_presentation', x: unit.x });
          }
        }
        if (!unit.oneMoreUsed && unit.specialCdMs === 0) {
          const allies = this.units.filter((ally) => ally.owner === unit.owner && ally.hp > 0);
          if (allies.some((ally) => ally.hp < ally.maxHp)) {
            for (const ally of allies) ally.hp = ally.maxHp;
            this.players[unit.owner].ultimateBuffMs = 15000;
            unit.oneMoreUsed = true;
            this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_one_more_thing', x: unit.x });
          }
        }
      }

      const isSemiconMedic = unit.def.id === 'semicon_t2_watch_medic';
      const isOrchardTrainer = unit.def.id === 'orchard_t2_watch_trainer';
      if ((isSemiconMedic || isOrchardTrainer) && unit.healCdMs === 0) {
        unit.healCdMs = 1000;
        const wounded = this.units.filter((other) => other.owner === unit.owner && other.hp > 0 &&
          other.hp < other.maxHp && Math.abs(other.x - unit.x) <= (isSemiconMedic ? 100 : 110));
        wounded.sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp ||
          Math.abs(left.x - unit.x) - Math.abs(right.x - unit.x) || left.id - right.id);
        if (wounded.length > 0) {
          for (const ally of isSemiconMedic ? wounded.slice(0, 3) : wounded) {
            ally.hp = Math.min(ally.maxHp, ally.hp + (isSemiconMedic ? 6 : 5));
          }
          this.emit({ type: 'skill', unitId: unit.id,
            skillId: isSemiconMedic ? 'semicon_heart_monitor' : 'orchard_trainer_heal', x: unit.x });
          unit.state = 'cast';
          unit.poseMs = 330;
        }
      }

      if (isSemiconMedic && unit.skillCdMs === 0) {
        const critical = this.units.filter((ally) => ally.owner === unit.owner && ally.hp > 0 &&
          ally.hp / ally.maxHp <= 0.2 && Math.abs(ally.x - unit.x) <= 100)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
        if (critical) {
          critical.speedBoostMs = Math.max(critical.speedBoostMs, 3000);
          unit.skillCdMs = 8000;
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_emergency_call', x: unit.x });
        }
      }

      let target = this.nearestEnemy(unit, dir);
      const enemyBaseX = unit.owner === 0 ? LOGICAL_MAX : 0;
      const reach = this.effectiveRange(unit) + CONTACT_PAD;
      if (unit.def.id === 'semicon_t7_book_station' && target &&
        Math.abs(target.x - unit.x) <= reach && !unit.deployed) {
        unit.deployed = true;
        unit.state = 'deploy';
        unit.poseMs = 330;
        this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_dex_mode', x: unit.x });
      }
      if (unit.def.id === 'semicon_t8_ai_assistant' && unit.skillCdMs === 0 && unit.silenceMs === 0) {
        const victim = this.units.filter((enemy) => enemy.owner !== unit.owner && enemy.hp > 0 &&
          Math.abs(enemy.x - unit.x) <= reach)
          .sort((a, b) => b.def.tier - a.def.tier || Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x))[0];
        if (victim) {
          victim.silenceMs = Math.max(victim.silenceMs, 5000);
          unit.skillCdMs = 10000;
          this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_routine_execute', x: unit.x });
        }
      }
      if (unit.def.id === 'orchard_t5_pad_shield' && unit.skillCdMs === 0 &&
        unit.silenceMs === 0 && target && Math.abs(target.x - unit.x) <= 60) {
        unit.skillCdMs = 12000;
        const amount = Math.max(1, Math.round((unit.def.attack ?? unit.def.dps) * 2.5 *
          this.enemyModifier(unit.owner) * this.attackBonus(unit) - (target.def.armor ?? 0)));
        target.hp -= amount;
        this.checkPairLoss(target);
        target.stunMs = Math.max(target.stunMs, 1500);
        this.emit({ type: 'hit', unitId: target.id, x: target.x, amount, crit: false });
        this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_pencil_stab', x: unit.x });
        if (target.hp <= 0 && !dead.includes(target)) {
          dead.push(target);
          killerById.set(target.id, unit);
        }
        if (target.hp <= 0) target = this.nearestEnemy(unit, dir);
      }
      const crowd = unit.def.id === 'semicon_t3_aphone' && this.units.filter((ally) =>
        ally.owner === unit.owner && ally.def.id === unit.def.id && ally.hp > 0 &&
        Math.abs(ally.x - unit.x) <= 100).length >= 3;
      const founderHaste = unit.owner === 1 && this.units.some((ally) =>
        ally.owner === 1 && ally.def.id === 'orchard_t9_founder' && ally.hp > 0 &&
        Math.abs(ally.x - unit.x) <= 250);
      const attackInterval = (unit.def.attackIntervalMs ?? 1000) *
        (unit.malfunctionMs > 0 ? 1.3 : 1) /
        ((crowd ? 1.25 : 1) * (founderHaste ? 1.3 : 1) * (unit.pairBoosted ? 1.5 : 1));
      if (target && Math.abs(target.x - unit.x) <= reach) {
        unit.stationaryMs += TICK_MS;
        if (unit.attackCdMs === 0 && !unit.folded && unit.coolingMs === 0) {
          unit.attackCdMs = attackInterval;
          unit.attackCount++;
          unit.poseMs = 330;
          unit.state = 'attack';
          this.emit({ type: 'attack', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x, targetX: target.x });
          const victims = [target];
          const piercing = unit.def.id === 'semicon_t6_tab_artillery' && unit.attackCount % 4 === 0 &&
            unit.silenceMs === 0;
          if (piercing) {
            victims.splice(0, 1, ...this.units.filter((enemy) => enemy.owner !== unit.owner && enemy.hp > 0 &&
              (enemy.x - unit.x) * dir >= 0 && Math.abs(enemy.x - unit.x) <= reach)
              .sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x)).slice(0, 3));
            this.emit({ type: 'skill', unitId: unit.id, skillId: 'semicon_pen_throw', x: unit.x });
          } else if (unit.def.targetType === 'splash') {
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
              (1 + 0.12 * (this.players[unit.owner].upgradeLevels.rnd ?? 0) + 0.03 * mastery + ageBonus) *
              this.enemyModifier(unit.owner) * this.attackBonus(unit);
            const crit = unit.def.id === 'semicon_t4_sphone_sniper' && unit.stationaryMs >= 2500;
            const aim = unit.def.id === 'semicon_t4_sphone_sniper' && !crit ? 0.8 : 1;
            const protection = victim.def.id === 'orchard_t3_phone' && this.units.some((ally) =>
              ally !== victim && ally.owner === victim.owner && ally.hp > 0 &&
              Math.abs(ally.x - victim.x) <= 130) ? 0.9 : 1;
            const shield = unit.def.damageType === 'ranged' && this.units.some((ally) =>
              ally.owner === victim.owner && ally.def.id === 'orchard_t5_pad_shield' && ally.hp > 0 &&
              (victim.x - ally.x) * (victim.owner === 0 ? 1 : -1) < 0 &&
              Math.abs(victim.x - ally.x) <= 100) ? 0.65 : 1;
            const fold = victim.folded ? 0.6 : 1;
            const cooling = victim.coolingMs > 0 ? 1.2 : 1;
            const minimumRange = unit.def.id === 'semicon_t6_tab_artillery' &&
              Math.abs(victim.x - unit.x) < 70 ? 0.5 : 1;
            const armor = (victim.def.armor ?? 0) + (victim.deployed ? 25 : 0);
            const amount = Math.max(1, Math.round((attack * matrix * (crit ? 3 : aim) *
              minimumRange - armor) * protection * shield * fold * cooling));
            victim.hp -= amount;
            this.emit({ type: 'hit', unitId: victim.id, x: victim.x, amount, crit });
            this.checkPairLoss(victim);
            if (unit.def.id === 'semicon_t8_ai_assistant' && unit.silenceMs === 0) {
              for (const enemy of this.units) {
                if (enemy.owner !== unit.owner && enemy.hp > 0 && Math.abs(enemy.x - victim.x) <= 120) {
                  enemy.malfunctionMs = Math.max(enemy.malfunctionMs, 4000);
                }
              }
            }
            if (victim.hp <= 0 && !dead.includes(victim)) {
              dead.push(victim);
              killerById.set(victim.id, unit);
              if (unit.def.id === 'orchard_t4_phone_pro') unit.attackCdMs = 0;
            }
            if (crit) unit.stationaryMs = 0;
          }
          if (unit.def.id === 'orchard_t8_pro_notebook' && unit.silenceMs === 0) {
            unit.overheatStacks++;
            if (unit.overheatStacks >= 5) {
              unit.overheatStacks = 0;
              unit.coolingMs = 3000;
              this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_performance_mode', x: unit.x });
            }
          }
        } else if (unit.poseMs === 0) unit.state = 'idle';
      } else if (!target && Math.abs(enemyBaseX - unit.x) <= reach) {
        unit.stationaryMs += TICK_MS;
        if (unit.attackCdMs === 0 && !unit.folded && unit.coolingMs === 0) {
          unit.attackCdMs = attackInterval;
          unit.poseMs = 330;
          unit.state = 'attack';
          this.emit({ type: 'attack', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x, targetX: enemyBaseX });
          const victim: PlayerId = unit.owner === 0 ? 1 : 0;
          const matrix = this.balance.damageMatrix?.[unit.def.damageType ?? 'melee']?.structure ?? 1;
          const amount = Math.max(1, Math.round((unit.def.attack ?? unit.def.dps) * matrix *
            this.enemyModifier(unit.owner) * this.attackBonus(unit) *
            (unit.def.id === 'orchard_t8_pro_notebook' ? 2 : 1)));
          this.players[victim].baseHp = Math.max(0, this.players[victim].baseHp - amount);
          this.emit({ type: 'baseHit', owner: victim, amount });
          if (unit.def.id === 'orchard_t8_pro_notebook' && unit.silenceMs === 0) {
            unit.overheatStacks++;
            if (unit.overheatStacks >= 5) {
              unit.overheatStacks = 0;
              unit.coolingMs = 3000;
              this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_performance_mode', x: unit.x });
            }
          }
        } else if (unit.poseMs === 0) unit.state = 'idle';
      } else if (unit.rootMs > 0 || unit.deployed || !unit.folded &&
        unit.def.id === 'semicon_t5_fold' || this.blockedByAlly(unit, dir)) {
        unit.stationaryMs += TICK_MS;
        if (unit.poseMs === 0) unit.state = 'idle';
      } else {
        unit.stationaryMs = 0;
        if (unit.poseMs === 0) unit.state = 'move';
        const emergencySpeed = unit.speedBoostMs > 0 ? 1.4 : 1;
        const founderSlow = unit.owner === 0 && this.units.some((enemy) =>
          enemy.owner === 1 && enemy.def.id === 'orchard_t9_founder' && enemy.hp > 0 &&
          Math.abs(enemy.x - unit.x) <= 250) ? 0.8 : 1;
        unit.x = clamp(unit.x + dir * unit.def.speed * emergencySpeed * founderSlow *
          (unit.folded ? 1.3 : 1) * dt, 0, LOGICAL_MAX);
      }
    }

    for (const unit of dead) {
      if (unit.isIllusion) continue;
      const killer: PlayerId = unit.owner === 0 ? 1 : 0;
      const reward = Math.round(unit.def.cost * 0.4);
      this.awardKill(killer, reward);
      const victor = killerById.get(unit.id);
      if (victor && victor.hp > 0) {
        victor.killCount++;
        const trainer = this.units.find((ally) => ally.owner === victor.owner &&
          ally.def.id === 'orchard_t2_watch_trainer' && ally.hp > 0 &&
          Math.abs(ally.x - victor.x) <= 110);
        if (trainer && victor.killCount % 3 === 0 && victor.ringStacks < 5) {
          victor.ringStacks++;
          this.emit({ type: 'skill', unitId: trainer.id, skillId: 'orchard_close_rings', x: trainer.x });
        }
      }
      this.onUnitKilled(unit);
      this.emit({ type: 'kill', unitId: unit.id, defId: unit.def.id, owner: unit.owner, x: unit.x });
    }
    if (dead.length > 0 || vanished.length > 0) {
      this.units = this.units.filter((unit) => !dead.includes(unit) && !vanished.includes(unit));
    }
    if (dead.length > 0) this.syncSemiconAura();
    for (const owner of [0, 1] as const) {
      if (this.players[owner].baseHp > 0) continue;
      this.winner = owner === 0 ? 1 : 0;
      this.emit({ type: 'gameOver', winner: this.winner });
      return;
    }
    if (this.tick >= (this.options.timeLimitSeconds ?? 480) * 30) {
      const left = this.players[0].baseHp / this.players[0].baseMaxHp;
      const right = this.players[1].baseHp / this.players[1].baseMaxHp;
      this.winner = Math.abs(left - right) < 1e-9 ? null : left > right ? 0 : 1;
      this.emit({ type: 'gameOver', winner: this.winner });
    }
  }

  private nearestEnemy(unit: SimUnit, dir: 1 | -1): SimUnit | null {
    const candidates = this.units.filter((other) =>
      other.owner !== unit.owner && other.hp > 0 && (other.x - unit.x) * dir >= -CONTACT_PAD &&
      !(other.ghostMs > 0 && unit.def.roles?.includes('melee')));
    if (candidates.length === 0) return null;
    const reachable = candidates.filter((other) => Math.abs(other.x - unit.x) <= this.effectiveRange(unit) + CONTACT_PAD);
    const pool = reachable.length > 0 ? reachable : candidates;
    pool.sort((left, right) => {
      if (left.isIllusion !== right.isIllusion && reachable.length > 0) {
        return left.isIllusion ? -1 : 1;
      }
      if (unit.def.targetPolicy === 'lowestHpRatio' && reachable.length > 0) {
        const ratio = left.hp / left.maxHp - right.hp / right.maxHp;
        if (ratio !== 0) return ratio;
      }
      const a = Math.abs(left.x - unit.x);
      const b = Math.abs(right.x - unit.x);
      return (unit.def.targetPolicy === 'farthest' && reachable.length > 0 ? b - a : a - b) || left.id - right.id;
    });
    return pool[0] ?? null;
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
        this.checkPairLoss(target);
      this.emit({ type: 'hit', unitId: target.id, x: target.x, amount, crit: false });
      if (target.hp <= 0) {
        if (!target.isIllusion) {
          this.awardKill(owner, Math.round(target.def.cost * 0.4));
          this.onUnitKilled(target);
          this.emit({ type: 'kill', unitId: target.id, defId: target.def.id, owner: target.owner, x: target.x });
        }
        this.units = this.units.filter((unit) => unit !== target);
      }
    }
  }

  private onUnitKilled(unit: SimUnit): void {
    if (unit.def.id !== 'orchard_t1_airpods') return;
    for (const enemy of this.units) {
      if (enemy.owner !== unit.owner && enemy.hp > 0 && Math.abs(enemy.x - unit.x) <= 60) {
        enemy.silenceMs = Math.max(enemy.silenceMs, 1500);
      }
    }
    this.emit({ type: 'skill', unitId: unit.id, skillId: 'orchard_noise_cancel', x: unit.x });
  }

  private awardKill(owner: PlayerId, reward: number): void {
    const player = this.players[owner];
    player.cash = Math.min(this.balance.cashCap ?? 9999, player.cash + reward);
    player.cumulativeCash += reward;
  }

  /** 앞선 아군과 겹치지 않게 줄 세우기 — 스프라이트가 포개지는 걸 막는다. */
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
      elapsedMs: this.tick * 1000 / TICK_HZ,
      units,
      projectiles: [],
      players: [this.snapshotPlayer(0), this.snapshotPlayer(1)],
      me: this.me,
      phase: this.winner === undefined ? 'playing' : 'over',
      ...(this.winner === undefined ? {} : { winner: this.winner }),
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
      ultimateBuffMs: 0,
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
