import { aggregateResults } from './aggregate.js';
import type { BatchSummary, HeadlessAdapter, MatchRequest, MatchResult } from './types.js';

export interface BatchRunResult {
  results: MatchResult[];
  summary: BatchSummary;
}

export async function runBatch(adapter: HeadlessAdapter, requests: readonly MatchRequest[]): Promise<BatchRunResult> {
  const results: MatchResult[] = [];
  for (const request of requests) results.push(await adapter.runMatch(request));
  return { results, summary: aggregateResults(results, adapter) };
}
