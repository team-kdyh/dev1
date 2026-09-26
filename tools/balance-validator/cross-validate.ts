import type { BalanceDocuments, ValidationIssue } from './types.js';

function error(file: string, path: string, message: string): ValidationIssue {
  return { severity: 'error', file, path, message };
}

function warning(file: string, path: string, message: string): ValidationIssue {
  return { severity: 'warning', file, path, message };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function detectCycles(nodes: Map<string, string[]>): string[][] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (id: string): void => {
    if (visiting.has(id)) {
      const start = stack.indexOf(id);
      cycles.push([...stack.slice(start), id]);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    stack.push(id);
    for (const next of nodes.get(id) ?? []) visit(next);
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of nodes.keys()) visit(id);
  return cycles;
}

export function crossValidate(documents: BalanceDocuments): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const register = (id: unknown, kind: string, file: string): void => {
    if (typeof id !== 'string') return;
    const previous = ids.get(id);
    if (previous) issues.push(error(file, id, `ID가 ${previous}와 중복됩니다.`));
    else ids.set(id, kind);
  };

  documents.units.forEach((unit) => register(unit.id, 'unit', 'balance/units'));
  documents.skills.forEach((skill) => register(skill.id, 'skill', 'balance/skills'));
  documents.strategies.forEach((strategy) => register(strategy.id, 'strategy', 'balance/strategies.json'));
  documents.upgrades.forEach((upgrade) => register(upgrade.id, 'upgrade', 'balance/upgrades.json'));

  const unitIds = new Set(documents.units.map((unit) => unit.id).filter((id): id is string => typeof id === 'string'));
  const skillIds = new Set(documents.skills.map((skill) => skill.id).filter((id): id is string => typeof id === 'string'));
  const strategyIds = new Set(documents.strategies.map((strategy) => strategy.id).filter((id): id is string => typeof id === 'string'));
  const assetKeys = new Set(stringArray(documents.assetManifest.keys));

  for (const factionId of ['semicon', 'orchard']) {
    const factionUnits = documents.units.filter((unit) => unit.faction === factionId);
    if (factionUnits.length !== 9) issues.push(error('balance/units', factionId, `유닛이 9종이어야 하지만 ${factionUnits.length}종입니다.`));
    const tiers = new Set<number>();
    let previousCost = -Infinity;
    for (const unit of [...factionUnits].sort((a, b) => Number(a.tier) - Number(b.tier))) {
      const tier = Number(unit.tier);
      if (tiers.has(tier)) issues.push(error('balance/units', String(unit.id), `티어 ${tier}가 중복됩니다.`));
      tiers.add(tier);
      const cost = Number(unit.cost);
      if (cost < previousCost) issues.push(error('balance/units', String(unit.id), '고티어 유닛 비용이 이전 티어보다 낮습니다.'));
      previousCost = cost;

      for (const skillId of stringArray(unit.skills)) {
        if (!skillIds.has(skillId)) issues.push(error('balance/units', `${String(unit.id)}.skills`, `존재하지 않는 스킬 ${skillId}을 참조합니다.`));
      }
      const assets = unit.assets as Record<string, unknown> | undefined;
      for (const [key, value] of Object.entries(assets ?? {})) {
        if (typeof value === 'string' && !assetKeys.has(value)) issues.push(error('balance/units', `${String(unit.id)}.assets.${key}`, `에셋 키 ${value}가 매니페스트에 없습니다.`));
      }
    }
    for (let tier = 1; tier <= 9; tier += 1) {
      if (!tiers.has(tier)) issues.push(error('balance/units', factionId, `티어 ${tier} 유닛이 없습니다.`));
    }
  }

  for (const skill of documents.skills) {
    const allEffects = [...((skill.effects as Array<Record<string, unknown>>) ?? []), ...((skill.fallbackEffects as Array<Record<string, unknown>>) ?? [])];
    for (const effect of allEffects) {
      if (effect.type === 'summon' && typeof effect.unitId === 'string' && !unitIds.has(effect.unitId)) {
        issues.push(error('balance/skills', `${String(skill.id)}.effects`, `소환 유닛 ${effect.unitId}이 없습니다.`));
      }
    }
  }

  for (const faction of documents.factions) {
    for (const unitId of stringArray(faction.units)) {
      if (!unitIds.has(unitId)) issues.push(error('balance/factions.json', `${String(faction.id)}.units`, `유닛 ${unitId}이 없습니다.`));
    }
    for (const strategyId of stringArray(faction.strategySkills)) {
      if (!strategyIds.has(strategyId)) issues.push(error('balance/factions.json', `${String(faction.id)}.strategySkills`, `전략 스킬 ${strategyId}이 없습니다.`));
    }
    const baseSprites = faction.baseSprites as Record<string, unknown> | undefined;
    for (const value of Object.values(baseSprites ?? {})) {
      if (typeof value === 'string' && !assetKeys.has(value)) issues.push(error('balance/factions.json', `${String(faction.id)}.baseSprites`, `에셋 키 ${value}가 매니페스트에 없습니다.`));
    }
  }

  for (const upgrade of documents.upgrades) {
    const costs = Array.isArray(upgrade.costs) ? upgrade.costs : [];
    const values = ((upgrade.effect as Record<string, unknown> | undefined)?.values as unknown[]) ?? [];
    if (costs.length !== Number(upgrade.maxLevel)) issues.push(error('balance/upgrades.json', String(upgrade.id), 'maxLevel과 비용 개수가 다릅니다.'));
    if (values.length !== Number(upgrade.maxLevel)) issues.push(error('balance/upgrades.json', String(upgrade.id), 'maxLevel과 효과 값 개수가 다릅니다.'));
    for (let index = 1; index < costs.length; index += 1) {
      if (Number(costs[index]) <= Number(costs[index - 1])) issues.push(warning('balance/upgrades.json', String(upgrade.id), '레벨 비용이 증가하지 않습니다.'));
    }
  }

  const matrixDoc = documents.damageMatrix;
  const armorClasses = stringArray(matrixDoc.armorClasses);
  const damageTypes = stringArray(matrixDoc.damageTypes);
  const matrix = (matrixDoc.matrix ?? {}) as Record<string, Record<string, unknown>>;
  for (const type of damageTypes) {
    if (!matrix[type]) issues.push(error('balance/damage_matrix.json', type, '피해 타입 행이 없습니다.'));
    for (const armor of armorClasses) {
      if (typeof matrix[type]?.[armor] !== 'number') issues.push(error('balance/damage_matrix.json', `${type}.${armor}`, '피해 배율이 없습니다.'));
    }
  }

  const stageIds = new Set(documents.stages.map((stage) => stage.id).filter((id): id is string => typeof id === 'string'));
  const stageGraph = new Map<string, string[]>();
  for (const stage of documents.stages) {
    const id = String(stage.id);
    const requirements = stringArray(stage.unlockRequires);
    stageGraph.set(id, requirements);
    if (!id.startsWith(`${String(stage.faction)}_`)) issues.push(error('campaign/stages.json', id, '스테이지 ID와 진영이 일치하지 않습니다.'));
    if (stage.faction === stage.enemyFaction) issues.push(error('campaign/stages.json', id, '아군과 적 진영이 같습니다.'));
    for (const requirement of requirements) if (!stageIds.has(requirement)) issues.push(error('campaign/stages.json', `${id}.unlockRequires`, `선행 스테이지 ${requirement}이 없습니다.`));
    const rules = stage.rules as Record<string, unknown>;
    for (const unitId of stringArray(rules?.bannedUnits)) if (!unitIds.has(unitId)) issues.push(error('campaign/stages.json', `${id}.bannedUnits`, `금지 유닛 ${unitId}이 없습니다.`));
  }
  for (const factionId of ['semicon', 'orchard']) {
    const count = documents.stages.filter((stage) => stage.faction === factionId).length;
    if (count !== 12) issues.push(error('campaign/stages.json', factionId, `스테이지가 12개여야 하지만 ${count}개입니다.`));
  }
  for (const cycle of detectCycles(stageGraph)) issues.push(error('campaign/stages.json', cycle.join(' -> '), '해금 그래프에 순환이 있습니다.'));

  const researchNodes = Array.isArray(documents.research.nodes) ? documents.research.nodes as Array<Record<string, unknown>> : [];
  const researchIds = new Set(researchNodes.map((node) => node.id).filter((id): id is string => typeof id === 'string'));
  const researchGraph = new Map<string, string[]>();
  for (const node of researchNodes) {
    const id = String(node.id);
    const requirements = stringArray(node.requires);
    researchGraph.set(id, requirements);
    for (const requirement of requirements) if (!researchIds.has(requirement)) issues.push(error('meta/research_tree.json', `${id}.requires`, `연구 노드 ${requirement}이 없습니다.`));
    const levels = Array.isArray(node.levels) ? node.levels as Array<Record<string, unknown>> : [];
    for (let index = 1; index < levels.length; index += 1) {
      if (Number(levels[index]?.cost) <= Number(levels[index - 1]?.cost)) issues.push(error('meta/research_tree.json', id, '연구 레벨 비용이 증가하지 않습니다.'));
    }
  }
  for (const cycle of detectCycles(researchGraph)) issues.push(error('meta/research_tree.json', cycle.join(' -> '), '연구 트리에 순환이 있습니다.'));
  if (documents.research.rankedPolicy !== 'disabled') issues.push(error('meta/research_tree.json', 'rankedPolicy', '랭크에서는 메타 업그레이드를 비활성화해야 합니다.'));

  if (documents.assetManifest.placeholder === true) {
    issues.push(warning('assets.manifest.json', 'placeholder', '에셋 매니페스트가 플레이스홀더 상태입니다. 트랙 D의 실제 매니페스트로 교체해야 합니다.'));
  }
  return issues;
}
