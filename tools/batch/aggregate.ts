import type { BatchSummary, HeadlessAdapter, MatchResult, UnitAggregate, UnitMatchStats } from './types.js';

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

export function aggregateResults(results: readonly MatchResult[], adapter: HeadlessAdapter): BatchSummary {
  const wins = { p0: 0, p1: 0, draw: 0 };
  const units = new Map<string, UnitMatchStats & { gamesPicked: number }>();
  for (const result of results) {
    wins[result.winner] += 1;
    for (const [unitId, stats] of Object.entries(result.unitStats)) {
      const total = units.get(unitId) ?? { produced: 0, kills: 0, damage: 0, costSpent: 0, gamesPicked: 0 };
      total.produced += stats.produced;
      total.kills += stats.kills;
      total.damage += stats.damage;
      total.costSpent += stats.costSpent;
      if (stats.produced > 0) total.gamesPicked += 1;
      units.set(unitId, total);
    }
  }
  const matches = results.length;
  const unitAggregates: UnitAggregate[] = [...units.entries()].map(([unitId, stats]) => ({
    unitId,
    gamesPicked: stats.gamesPicked,
    pickRate: matches === 0 ? 0 : stats.gamesPicked / matches,
    produced: stats.produced,
    kills: stats.kills,
    damage: stats.damage,
    costSpent: stats.costSpent,
    killsPer1000Cash: stats.costSpent === 0 ? 0 : stats.kills * 1000 / stats.costSpent
  })).sort((a, b) => a.unitId.localeCompare(b.unitId));
  const durations = results.map((result) => result.durationSeconds);
  const invalidCommands = results.reduce((sum, result) => sum + result.invalidCommands, 0);
  const maxTickExceeded = results.filter((result) => result.maxTickExceeded).length;
  const warnings: string[] = [];
  const p0Rate = matches === 0 ? 0 : wins.p0 / matches;
  const p1Rate = matches === 0 ? 0 : wins.p1 / matches;
  const avgDuration = average(durations) ?? 0;
  if (!adapter.authoritative) warnings.push('스모크 어댑터 결과는 밸런스 판정에 사용할 수 없습니다.');
  if (adapter.authoritative && (p0Rate < 0.45 || p0Rate > 0.55 || p1Rate < 0.45 || p1Rate > 0.55)) warnings.push('진영 승률이 45~55% 범위를 벗어났습니다.');
  if (adapter.authoritative && (avgDuration < 240 || avgDuration > 480)) warnings.push('평균 게임 길이가 4~8분 범위를 벗어났습니다.');
  if (invalidCommands > 0) warnings.push(`무효 커맨드가 ${invalidCommands}회 발생했습니다.`);
  if (maxTickExceeded > 0) warnings.push(`${maxTickExceeded}경기가 최대 틱을 초과했습니다.`);
  if (adapter.authoritative && unitAggregates.some((unit) => unit.pickRate <= 0.03)) warnings.push('픽률 3% 이하 유닛이 있습니다.');

  return {
    adapterId: adapter.id,
    authoritative: adapter.authoritative,
    matches,
    wins,
    winRates: { p0: p0Rate, p1: p1Rate, draw: matches === 0 ? 0 : wins.draw / matches },
    duration: { average: avgDuration, median: percentile(durations, 0.5), p90: percentile(durations, 0.9) },
    ageReachedAtAverage: {
      p0Age2: average(results.flatMap((result) => result.ageReachedAt.p0[2] ?? [])),
      p0Age3: average(results.flatMap((result) => result.ageReachedAt.p0[3] ?? [])),
      p1Age2: average(results.flatMap((result) => result.ageReachedAt.p1[2] ?? [])),
      p1Age3: average(results.flatMap((result) => result.ageReachedAt.p1[3] ?? []))
    },
    invalidCommands,
    maxTickExceeded,
    units: unitAggregates,
    verdict: !adapter.authoritative ? 'NON_AUTHORITATIVE' : warnings.length === 0 ? 'PASS' : 'WARN',
    warnings
  };
}
