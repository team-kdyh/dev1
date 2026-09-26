import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DifficultyId, FactionId } from '../../src/ai/types.js';
import { createProjectAdapter } from './adapters/project.js';
import { createSmokeAdapter } from './adapters/smoke.js';
import { summaryToCsv } from './reporters/csv.js';
import { runBatch } from './run-batch.js';
import type { HeadlessAdapter, MatchRequest } from './types.js';

function argsOf(argv: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token?.startsWith('--')) continue;
    const [inlineKey, inlineValue] = token.slice(2).split('=', 2);
    const next = argv[index + 1];
    if (inlineValue !== undefined) result.set(inlineKey ?? '', inlineValue);
    else if (next && !next.startsWith('--')) { result.set(inlineKey ?? '', next); index += 1; }
    else result.set(inlineKey ?? '', 'true');
  }
  return result;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value as T)) throw new Error(`${label}: ${value}. 허용값: ${allowed.join(', ')}`);
  return value as T;
}

async function loadAdapter(specifier: string): Promise<HeadlessAdapter> {
  if (specifier === 'smoke') return createSmokeAdapter();
  if (specifier === 'project') return createProjectAdapter();
  const absolute = path.resolve(specifier);
  const module = await import(pathToFileURL(absolute).href) as { createAdapter?: () => HeadlessAdapter; default?: HeadlessAdapter };
  const adapter = module.createAdapter?.() ?? module.default;
  if (!adapter || typeof adapter.runMatch !== 'function') throw new Error(`${absolute}가 HeadlessAdapter를 내보내지 않습니다.`);
  return adapter;
}

async function main(): Promise<void> {
  const args = argsOf(process.argv.slice(2));
  const count = Number(args.get('n') ?? 20);
  const seed = Number(args.get('seed') ?? 1000);
  const p0Faction = oneOf(args.get('p0') ?? 'semicon', ['semicon', 'orchard'] as const, 'p0 faction');
  const p1Faction = oneOf(args.get('p1') ?? 'orchard', ['semicon', 'orchard'] as const, 'p1 faction');
  const sharedDifficulty = args.get('ai') ?? 'normal';
  const p0Difficulty = oneOf(args.get('p0-ai') ?? sharedDifficulty, ['easy', 'normal', 'hard', 'expert'] as const, 'p0 difficulty');
  const p1Difficulty = oneOf(args.get('p1-ai') ?? sharedDifficulty, ['easy', 'normal', 'hard', 'expert'] as const, 'p1 difficulty');
  const maxTicks = Number(args.get('max-ticks') ?? 14_400);
  const out = path.resolve(args.get('out') ?? 'reports/report.csv');
  if (!Number.isInteger(count) || count <= 0) throw new Error('--n은 양의 정수여야 합니다.');
  if (!Number.isInteger(seed)) throw new Error('--seed는 정수여야 합니다.');

  const adapter = await loadAdapter(args.get('adapter') ?? 'project');
  if (!adapter.authoritative) process.stderr.write('WARNING: 비권위 스모크 어댑터입니다. 결과를 밸런스 근거로 사용하지 마세요.\n');
  const requests: MatchRequest[] = Array.from({ length: count }, (_, index) => ({
    index,
    seed: seed + index,
    p0: { faction: p0Faction as FactionId, difficulty: p0Difficulty as DifficultyId },
    p1: { faction: p1Faction as FactionId, difficulty: p1Difficulty as DifficultyId },
    maxTicks
  }));
  const result = await runBatch(adapter, requests);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, summaryToCsv(result.summary), 'utf8');
  const jsonPath = out.replace(/\.csv$/i, '.json');
  await writeFile(jsonPath, `${JSON.stringify({ summary: result.summary, matches: result.results }, null, 2)}\n`, 'utf8');
  process.stdout.write(`Adapter: ${adapter.id} (${adapter.authoritative ? 'authoritative' : 'NON-AUTHORITATIVE'})\n`);
  process.stdout.write(`Matches: ${result.summary.matches}, verdict: ${result.summary.verdict}\n`);
  process.stdout.write(`Report: ${out}\nRaw: ${jsonPath}\n`);
}

main().catch((cause) => {
  process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
  process.exitCode = 1;
});
