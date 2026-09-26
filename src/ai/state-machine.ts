import type { AiContext, AiMemory, AiStrategy } from './types.js';

export interface StateTransitionConfig {
  transitionLockTicks: number;
  pressureCashThreshold: number;
}

export function desiredStrategy(context: AiContext, pressureCashThreshold: number): AiStrategy {
  if (context.frontLine < 0.3 || context.myBaseHpRatio < 0.25) return 'DEFEND';
  if (context.frontLine > 0.75) return 'PUSH';
  if (context.powerRatio >= 1.2 && context.cash >= pressureCashThreshold) return 'PRESSURE';
  return 'BUILD';
}

export function transitionState(
  memory: AiMemory,
  context: AiContext,
  tick: number,
  config: StateTransitionConfig
): AiMemory {
  const desired = desiredStrategy(context, config.pressureCashThreshold);
  if (desired === memory.strategy) return memory;
  if (tick - memory.lastTransitionTick < config.transitionLockTicks) return memory;
  return { ...memory, strategy: desired, lastTransitionTick: tick };
}
