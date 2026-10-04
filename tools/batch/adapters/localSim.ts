import { FACTION_OF_PLAYER, GAME_BALANCE } from '../../../src/data/gameData.js';
import { LocalSimAdapter } from '../../../src/adapter/LocalSimAdapter.js';
import type { SimEvent } from '../../../src/sim/contracts.js';
import type { HeadlessAdapter, MatchRequest, MatchResult, UnitMatchStats } from '../types.js';

/**
 * 배치 시뮬레이터 ↔ LocalSimAdapter 연결.
 *
 * `project.ts`는 "트랙 B의 headless 러너가 아직 연결되지 않았습니다"라고 던지는 스텁이었다.
 * 그런데 `LocalSimAdapter`가 `advanceTicks()`로 이미 헤드리스 구동을 지원하므로
 * 밸런스 변경을 실제 대전 표본으로 검증할 수 있다.
 *
 * `authoritative: false`로 둔다 — 이건 브라우저 클라이언트가 쓰는 TypeScript 구현이고,
 * B의 Unity/C# 시뮬과 같은 결과라는 보장은 아직 없다. 둘을 맞춘 뒤에 true로 올려야 한다.
 */
export function createAdapter(): HeadlessAdapter {
  return {
    id: 'localSim',
    authoritative: false,

    async runMatch(request: MatchRequest): Promise<MatchResult> {
      // 한계: LocalSimAdapter는 진영을 플레이어 번호에 고정한다
      // (p0 = FACTION_OF_PLAYER[0]). 따라서 request.p0.faction / p1.faction은
      // 반영할 수 없다. 진영을 바꿔 돌리려면 시뮬에 진영 선택이 들어와야 한다.
      const sim = new LocalSimAdapter(GAME_BALANCE, request.seed, {
        me: 0,
        difficulty: request.p1.difficulty,
      });

      const unitStats: Record<string, UnitMatchStats> = {};
      const touch = (unitId: string): UnitMatchStats => {
        const existing = unitStats[unitId];
        if (existing) return existing;
        const fresh: UnitMatchStats = { produced: 0, kills: 0, damage: 0, costSpent: 0 };
        unitStats[unitId] = fresh;
        return fresh;
      };
      const costOf = (unitId: string): number =>
        GAME_BALANCE.units.find((unit) => unit.id === unitId)?.cost ?? 0;

      /** 공격자를 알 수 있는 유일한 경로가 attack 이벤트라, 마지막 공격자를 쫓아 kill을 귀속한다. */
      let lastAttacker: string | null = null;
      let invalidCommands = 0;
      const ageReachedAt: MatchResult['ageReachedAt'] = { p0: {}, p1: {} };

      sim.onEvents((events: SimEvent[]) => {
        for (const event of events) {
          switch (event.type) {
            case 'spawn': {
              const stats = touch(event.defId);
              stats.produced += 1;
              stats.costSpent += costOf(event.defId);
              break;
            }
            case 'attack':
              lastAttacker = event.defId;
              break;
            case 'hit':
              if (lastAttacker) touch(lastAttacker).damage += event.amount;
              break;
            case 'kill':
              // event.owner는 죽은 쪽이다 — 처치는 마지막 공격자에게 준다
              if (lastAttacker) touch(lastAttacker).kills += 1;
              break;
            case 'ageup': {
              const side = event.owner === 0 ? ageReachedAt.p0 : ageReachedAt.p1;
              const age = event.age as 2 | 3 | 4;
              if (age >= 2 && age <= 4 && side[age] === undefined) {
                side[age] = sim.getSnapshot().elapsedMs / 1000;
              }
              break;
            }
            case 'rejected':
              invalidCommands += 1;
              break;
            default:
              break;
          }
        }
      });

      // 사람 쪽(p0)은 LocalSimAdapter가 조작 주체로 두므로 여기서 몰아야 한다.
      // "시대를 올릴 수 있으면 올리고, 아니면 감당되는 최상위 티어를 뽑는다" —
      // 평범한 플레이어의 기본 전략이다. 시대업을 안 하면 T1만 찍다 끝나고
      // 상위 티어 표본이 아예 안 모인다(처음 돌렸을 때 p0가 그랬다).
      const roster = GAME_BALANCE.units
        .filter((unit) => unit.faction === FACTION_OF_PLAYER[0])
        .sort((left, right) => right.tier - left.tier);

      let ageUpCooldown = 0;
      for (let tick = 0; tick < request.maxTicks; tick += 1) {
        if (tick % 20 === 0) {
          const player = sim.getSnapshot().players[0];
          const nextAge = GAME_BALANCE.ages?.find((age) => age.age === player.age + 1);
          const canAgeUp =
            nextAge !== undefined &&
            player.cash >= nextAge.cost &&
            (player.cumulativeCash ?? 0) >= nextAge.cumulativeCashRequired;

          if (canAgeUp && ageUpCooldown <= 0) {
            sim.send({ type: 'AGE_UP' });
            ageUpCooldown = 90; // 거부 커맨드를 쏟아내지 않도록 잠시 쉰다
          } else {
            // 거부될 게 뻔한 커맨드는 보내지 않는다 — 쿨다운·캐시·인구를 먼저 본다
            const pick = roster.find(
              (unit) =>
                player.unlockedTiers.includes(unit.tier) &&
                player.cash >= unit.cost &&
                (player.cooldowns[unit.id] ?? 0) <= 0 &&
                player.supply + unit.supply <= player.supplyMax &&
                player.queue.length < (GAME_BALANCE.queueMax ?? 5),
            );
            if (pick) sim.send({ type: 'SPAWN_UNIT', defId: pick.id });
          }
          ageUpCooldown = Math.max(0, ageUpCooldown - 20);
        }
        sim.advanceTicks(1);
        if (sim.getSnapshot().phase === 'over') break;
      }

      const final = sim.getSnapshot();
      const maxTickExceeded = final.phase !== 'over';
      const winner: MatchResult['winner'] = maxTickExceeded
        ? 'draw'
        : final.winner === 0
          ? 'p0'
          : 'p1';

      return {
        index: request.index,
        seed: request.seed,
        winner,
        durationSeconds: final.elapsedMs / 1000,
        ageReachedAt,
        unitStats,
        invalidCommands,
        maxTickExceeded,
      };
    },
  };
}

export default createAdapter();
