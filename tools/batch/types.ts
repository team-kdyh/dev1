import type { DifficultyId, FactionId } from '../../src/ai/types.js';

export interface MatchRequest {
  index: number;
  seed: number;
  p0: { faction: FactionId; difficulty: DifficultyId };
  p1: { faction: FactionId; difficulty: DifficultyId };
  maxTicks: number;
}

export interface UnitMatchStats {
  produced: number;
  kills: number;
  damage: number;
  costSpent: number;
}

export interface MatchResult {
  index: number;
  seed: number;
  winner: 'p0' | 'p1' | 'draw';
  durationSeconds: number;
  ageReachedAt: { p0: Partial<Record<2 | 3 | 4, number>>; p1: Partial<Record<2 | 3 | 4, number>> };
  unitStats: Record<string, UnitMatchStats>;
  invalidCommands: number;
  maxTickExceeded: boolean;
  replayRef?: string;
}

export interface HeadlessAdapter {
  readonly id: string;
  readonly authoritative: boolean;
  runMatch(request: MatchRequest): Promise<MatchResult>;
}

export interface UnitAggregate {
  unitId: string;
  gamesPicked: number;
  pickRate: number;
  produced: number;
  kills: number;
  damage: number;
  costSpent: number;
  killsPer1000Cash: number;
}

export interface BatchSummary {
  adapterId: string;
  authoritative: boolean;
  matches: number;
  wins: { p0: number; p1: number; draw: number };
  winRates: { p0: number; p1: number; draw: number };
  duration: { average: number; median: number; p90: number };
  ageReachedAtAverage: { p0Age2: number | null; p0Age3: number | null; p1Age2: number | null; p1Age3: number | null };
  invalidCommands: number;
  maxTickExceeded: number;
  units: UnitAggregate[];
  verdict: 'NON_AUTHORITATIVE' | 'PASS' | 'WARN';
  warnings: string[];
}
