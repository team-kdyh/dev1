import { LocalSimAdapter } from '../src/adapter/LocalSimAdapter';
import { GAME_BALANCE, unitsOfFaction } from '../src/data/gameData';
import type { DifficultyId } from '../src/ai/types';

const requested = process.argv.find((arg) => arg.startsWith('--matches='));
const matches = requested ? Number(requested.slice('--matches='.length)) : 40;
if (!Number.isInteger(matches) || matches < 1 || matches > 1000) {
  throw new Error('--matches must be an integer between 1 and 1000');
}
const requestedDifficulty = process.argv.find((arg) => arg.startsWith('--difficulty='));
const difficulty = requestedDifficulty?.slice('--difficulty='.length) ?? 'normal';
if (!['easy', 'normal', 'hard', 'expert'].includes(difficulty)) {
  throw new Error('--difficulty must be easy, normal, hard, or expert');
}

/** 재현 가능한 단순 T1/T3 반복 전략. 이 결과는 실제 사람 승률이 아니다. */
function audit(me: 0 | 1): void {
  const faction = me === 0 ? 'semicon' : 'orchard';
  const roster = unitsOfFaction(GAME_BALANCE, faction);
  const tierOne = roster.find((unit) => unit.tier === 1);
  const tierThree = roster.find((unit) => unit.tier === 3);
  if (!tierOne || !tierThree) throw new Error(`Missing starter units for ${faction}`);
  const maxTicks = (GAME_BALANCE.matchTimeLimitSeconds ?? 480) * 30;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalSeconds = 0;
  let ageTwo = 0;
  let ageTwoSeconds = 0;
  let ageThree = 0;
  let ageThreeSeconds = 0;
  let finishedByBase = 0;
  let remainingFriendlyBaseHp = 0;
  let remainingEnemyBaseHp = 0;
  let firstClashSeconds = 0;
  let clashes = 0;
  for (let seed = 1; seed <= matches; seed++) {
    const sim = new LocalSimAdapter(GAME_BALANCE, seed, { me, difficulty: difficulty as DifficultyId });
    let ageTwoAt: number | undefined;
    let ageThreeAt: number | undefined;
    let clashAt: number | undefined;
    sim.onEvents((events) => {
      if (clashAt !== undefined) return;
      if (events.some((event) => event.type === 'attack' &&
        event.targetX !== undefined && event.targetX > 0 && event.targetX < 1000)) {
        clashAt = sim.getSnapshot().elapsedMs / 1000;
      }
    });
    for (let tick = 0; tick < maxTicks && sim.getSnapshot().phase === 'playing'; tick++) {
      if (tick % 30 === 0) {
        const cash = sim.getSnapshot().players[me].cash;
        sim.send({ type: 'SPAWN_UNIT', defId: cash >= tierThree.cost ? tierThree.id : tierOne.id });
      }
      sim.advanceTicks(1);
      if (ageTwoAt === undefined && sim.getSnapshot().players[me === 0 ? 1 : 0].age >= 2) {
        ageTwoAt = sim.getSnapshot().elapsedMs / 1000;
      }
      if (ageThreeAt === undefined && sim.getSnapshot().players[me === 0 ? 1 : 0].age >= 3) {
        ageThreeAt = sim.getSnapshot().elapsedMs / 1000;
      }
    }
    const snapshot = sim.getSnapshot();
    if (snapshot.phase !== 'over') throw new Error(`Match did not end: me=${me} seed=${seed}`);
    if (snapshot.winner === null) draws++;
    else if (snapshot.winner === me) wins++;
    else losses++;
    if (ageTwoAt !== undefined) { ageTwo++; ageTwoSeconds += ageTwoAt; }
    if (ageThreeAt !== undefined) { ageThree++; ageThreeSeconds += ageThreeAt; }
    if (clashAt !== undefined) { clashes++; firstClashSeconds += clashAt; }
    if (snapshot.players.some((player) => player.baseHp <= 0)) finishedByBase++;
    remainingFriendlyBaseHp += snapshot.players[me].baseHp / snapshot.players[me].baseMaxHp;
    const foe = me === 0 ? 1 : 0;
    remainingEnemyBaseHp += snapshot.players[foe].baseHp / snapshot.players[foe].baseMaxHp;
    totalSeconds += snapshot.elapsedMs / 1000;
  }
  console.log(JSON.stringify({ faction, matches,
    strategy: `T1/T3 spam vs ${difficulty} AI`, wins, losses, draws,
    meanSeconds: Math.round(totalSeconds / matches), finishedByBase,
    meanFirstClashSeconds: clashes ? Math.round(firstClashSeconds / clashes * 10) / 10 : null,
    aiReachedAgeTwo: ageTwo,
    meanAiAgeTwoSeconds: ageTwo ? Math.round(ageTwoSeconds / ageTwo) : null,
    aiReachedAgeThree: ageThree,
    meanAiAgeThreeSeconds: ageThree ? Math.round(ageThreeSeconds / ageThree) : null,
    meanFriendlyBaseHpPercent: Math.round(100 * remainingFriendlyBaseHp / matches),
    meanEnemyBaseHpPercent: Math.round(100 * remainingEnemyBaseHp / matches) }));
}

audit(0);
audit(1);
