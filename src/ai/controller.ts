import { selectWeightedAction } from './action-selector.js';
import { buildContext } from './context.js';
import { applyDifficultyPolicy } from './difficulty.js';
import { enumerateLegalActions, scoreActions } from './scoring.js';
import { transitionState } from './state-machine.js';
import type {
  AiCatalog,
  AiMemory,
  Command,
  DifficultyId,
  PlayerId,
  RandomSource,
  SimulationSnapshot
} from './types.js';

export interface EvaluateAiInput {
  snapshot: SimulationSnapshot;
  playerId: PlayerId;
  difficulty: DifficultyId;
  catalog: AiCatalog;
  memory: AiMemory;
  rng: RandomSource;
}

export interface EvaluateAiResult {
  memory: AiMemory;
  command?: Command;
}

export function createInitialMemory(): AiMemory {
  return { strategy: 'BUILD', lastTransitionTick: -Infinity, nextDecisionTick: 0, pendingCommands: [] };
}

export function evaluateAi(input: EvaluateAiInput): EvaluateAiResult {
  const { snapshot, playerId, catalog, rng } = input;
  const due = input.memory.pendingCommands.find((pending) => pending.executeTick <= snapshot.tick);
  if (due) {
    return {
      command: { ...due.command, tick: snapshot.tick },
      memory: {
        ...input.memory,
        pendingCommands: input.memory.pendingCommands.filter((pending) => pending !== due)
      }
    };
  }
  if (input.memory.pendingCommands.length > 0 || snapshot.tick < input.memory.nextDecisionTick) {
    return { memory: input.memory };
  }

  const context = buildContext(snapshot, playerId);
  let memory = transitionState(input.memory, context, snapshot.tick, {
    transitionLockTicks: catalog.transitionLockTicks,
    pressureCashThreshold: catalog.pressureCashThreshold
  });
  const profile = catalog.difficulties[input.difficulty];
  const legal = enumerateLegalActions(snapshot, playerId, catalog);
  const scored = scoreActions(legal, memory.strategy, context, catalog, rng.next() < profile.counterAccuracy);
  const adjusted = applyDifficultyPolicy(scored, profile, rng);
  const selected = selectWeightedAction(adjusted, rng);
  const nextDecisionTick = snapshot.tick + catalog.evaluationIntervalTicks;
  if (!selected) return { memory: { ...memory, nextDecisionTick } };

  const executeTick = snapshot.tick + Math.round(profile.reactionDelaySeconds * snapshot.tickRate);
  const scheduled = { executeTick, command: { ...selected.command, tick: executeTick } };
  memory = { ...memory, nextDecisionTick, pendingCommands: [...memory.pendingCommands, scheduled] };
  if (executeTick <= snapshot.tick) {
    return { command: scheduled.command, memory: { ...memory, pendingCommands: [] } };
  }
  return { memory };
}
