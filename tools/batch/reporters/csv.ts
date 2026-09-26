import type { BatchSummary } from '../types.js';

function cell(value: string | number | boolean | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function summaryToCsv(summary: BatchSummary): string {
  const rows: Array<Array<string | number | boolean | null>> = [
    ['section', 'key', 'value', 'detail'],
    ['meta', 'adapter', summary.adapterId, `authoritative=${summary.authoritative}`],
    ['meta', 'matches', summary.matches, summary.verdict],
    ['result', 'p0WinRate', summary.winRates.p0, 'target=0.45..0.55'],
    ['result', 'p1WinRate', summary.winRates.p1, 'target=0.45..0.55'],
    ['result', 'drawRate', summary.winRates.draw, ''],
    ['duration', 'averageSeconds', summary.duration.average, 'target=240..480'],
    ['duration', 'medianSeconds', summary.duration.median, ''],
    ['duration', 'p90Seconds', summary.duration.p90, ''],
    ['age', 'p0Age2Average', summary.ageReachedAtAverage.p0Age2, 'target=60..90'],
    ['age', 'p0Age3Average', summary.ageReachedAtAverage.p0Age3, 'target=150..210'],
    ['age', 'p1Age2Average', summary.ageReachedAtAverage.p1Age2, 'target=60..90'],
    ['age', 'p1Age3Average', summary.ageReachedAtAverage.p1Age3, 'target=150..210'],
    ['health', 'invalidCommands', summary.invalidCommands, 'target=0'],
    ['health', 'maxTickExceeded', summary.maxTickExceeded, 'target=0']
  ];
  for (const unit of summary.units) {
    rows.push(['unit', unit.unitId, unit.pickRate, `produced=${unit.produced};kills=${unit.kills};killsPer1000Cash=${unit.killsPer1000Cash.toFixed(3)}`]);
  }
  for (const warning of summary.warnings) rows.push(['warning', 'warning', warning, '']);
  return `${rows.map((row) => row.map(cell).join(',')).join('\n')}\n`;
}
