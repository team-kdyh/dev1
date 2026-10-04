import { LocalSimAdapter } from '../src/adapter/LocalSimAdapter';
import { GAME_BALANCE } from '../src/data/gameData';
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
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalSeconds = 0;
  let ageTwo = 0;
  let ageTwoSeconds = 0;
  let finishedByBase = 0;
  let remainingFriendlyBaseHp = 0;
  let remainingEnemyBaseHp = 0;
  for (let seed = 1; seed <= matches; seed++) {
    const sim = new LocalSimAdapter(GAME_BALANCE, seed, { me, difficulty: difficulty as DifficultyId });
    let ageTwoAt: number | undefined;
    for (let tick = 0; tick < 30 * 480 && sim.getSnapshot().phase === 'playing'; tick++) {
      if (tick % 30 === 0) {
        const cash = sim.getSnapshot().players[me].cash;
        sim.send({ type: 'SPAWN_UNIT', defId: me === 0
          ? cash >= 140 ? 'semicon_t3_aphone' : 'semicon_t1_buds'
          : cash >= 150 ? 'orchard_t3_phone' : 'orchard_t1_airpods' });
      }
      sim.advanceTicks(1);
      if (ageTwoAt === undefined && sim.getSnapshot().players[me === 0 ? 1 : 0].age >= 2) {
        ageTwoAt = sim.getSnapshot().elapsedMs / 1000;
      }
    }
    const snapshot = sim.getSnapshot();
    if (snapshot.phase !== 'over') throw new Error(`Match did not end: me=${me} seed=${seed}`);
    if (snapshot.winner === null) draws++;
    else if (snapshot.winner === me) wins++;
    else losses++;
    if (ageTwoAt !== undefined) { ageTwo++; ageTwoSeconds += ageTwoAt; }
    if (snapshot.players.some((player) => player.baseHp <= 0)) finishedByBase++;
    remainingFriendlyBaseHp += snapshot.players[me].baseHp / snapshot.players[me].baseMaxHp;
    const foe = me === 0 ? 1 : 0;
    remainingEnemyBaseHp += snapshot.players[foe].baseHp / snapshot.players[foe].baseMaxHp;
    totalSeconds += snapshot.elapsedMs / 1000;
  }
  console.log(JSON.stringify({ faction: me === 0 ? 'semicon' : 'orchard', matches,
    strategy: `T1/T3 spam vs ${difficulty} AI`, wins, losses, draws,
    meanSeconds: Math.round(totalSeconds / matches), finishedByBase,
    aiReachedAgeTwo: ageTwo,
    meanAiAgeTwoSeconds: ageTwo ? Math.round(ageTwoSeconds / ageTwo) : null,
    meanFriendlyBaseHpPercent: Math.round(100 * remainingFriendlyBaseHp / matches),
    meanEnemyBaseHpPercent: Math.round(100 * remainingEnemyBaseHp / matches) }));
}

audit(0);
audit(1);
