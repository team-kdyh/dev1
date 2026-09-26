import semicon from '../../../src/data/balance/units/semicon.json' with { type: 'json' };
import orchard from '../../../src/data/balance/units/orchard.json' with { type: 'json' };
import { XorShift32 } from '../../../src/ai/rng.js';
import type { UnitDefinition } from '../../../src/ai/types.js';
import type { HeadlessAdapter, MatchRequest, MatchResult, UnitMatchStats } from '../types.js';

const units = [...semicon.units, ...orchard.units] as unknown as UnitDefinition[];

function draftStats(request: MatchRequest, rng: XorShift32): Record<string, UnitMatchStats> {
  const stats: Record<string, UnitMatchStats> = {};
  for (const unit of units.filter((candidate) => candidate.faction === request.p0.faction || candidate.faction === request.p1.faction)) {
    const produced = Math.floor(rng.next() * 7);
    stats[unit.id] = {
      produced,
      kills: Math.floor(produced * rng.next() * 1.6),
      damage: Math.round(produced * unit.stats.atk * unit.stats.atkSpeed * (20 + rng.next() * 80)),
      costSpent: produced * unit.cost
    };
  }
  return stats;
}

export function createSmokeAdapter(): HeadlessAdapter {
  return {
    id: 'smoke-non-authoritative-v1',
    authoritative: false,
    async runMatch(request: MatchRequest): Promise<MatchResult> {
      const rng = new XorShift32(request.seed);
      const roll = rng.next();
      const winner = roll < 0.485 ? 'p0' : roll < 0.97 ? 'p1' : 'draw';
      const durationSeconds = 240 + Math.round(rng.next() * 240);
      return {
        index: request.index,
        seed: request.seed,
        winner,
        durationSeconds,
        ageReachedAt: {
          p0: { 2: 60 + Math.round(rng.next() * 30), 3: 150 + Math.round(rng.next() * 60) },
          p1: { 2: 60 + Math.round(rng.next() * 30), 3: 150 + Math.round(rng.next() * 60) }
        },
        unitStats: draftStats(request, rng),
        invalidCommands: 0,
        maxTickExceeded: false
      };
    }
  };
}
