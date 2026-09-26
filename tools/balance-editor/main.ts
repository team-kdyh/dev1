import Ajv from 'ajv';
import unitSchema from '../../src/data/schema/unit.schema.json';
import semiconSource from '../../src/data/balance/units/semicon.json';
import orchardSource from '../../src/data/balance/units/orchard.json';

interface EditableUnit {
  id: string;
  faction: 'semicon' | 'orchard';
  tier: number;
  name: string;
  cost: number;
  supply: number;
  cooldown: number;
  stats: {
    hp: number; armor: number; atk: number; atkSpeed: number; range: number; moveSpeed: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface UnitDocument { $schema: string; units: EditableUnit[] }

const fieldDefinitions = [
  ['cost', '비용', 'cost'], ['supply', '인구', 'supply'], ['cooldown', '생산 쿨', 'cooldown'],
  ['stats.hp', 'HP', 'hp'], ['stats.armor', '방어', 'armor'], ['stats.atk', '공격', 'atk'],
  ['stats.atkSpeed', '공속', 'atkSpeed'], ['stats.range', '사거리', 'range'], ['stats.moveSpeed', '이속', 'moveSpeed']
] as const;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Editor mount point ${selector} is missing.`);
  return element;
}

const editor = requiredElement<HTMLElement>('#editor');
const status = requiredElement<HTMLElement>('#validation-status');
const messages = requiredElement<HTMLElement>('#messages');

let original: Record<'semicon' | 'orchard', UnitDocument>;
let documents: Record<'semicon' | 'orchard', UnitDocument>;
const ajv = new Ajv({ allErrors: true, strict: false });
const validateUnits = ajv.compile(unitSchema);

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function readPath(unit: EditableUnit, path: string): number {
  if (!path.includes('.')) return Number(unit[path]);
  const [, child] = path.split('.');
  return Number(unit.stats[child ?? '']);
}

function writePath(unit: EditableUnit, path: string, value: number): void {
  if (!path.includes('.')) unit[path] = value;
  else {
    const [, child] = path.split('.');
    if (child) unit.stats[child] = value;
  }
}

function metricValues(unit: EditableUnit): { dps: string; hpCost: string; dpsCost: string } {
  const dps = unit.stats.atk * unit.stats.atkSpeed;
  return {
    dps: dps.toFixed(1),
    hpCost: (unit.stats.hp / unit.cost).toFixed(2),
    dpsCost: (dps / unit.cost).toFixed(3)
  };
}

function unitCard(unit: EditableUnit, index: number): string {
  const fields = fieldDefinitions.map(([path, label]) => `
    <label>${label}<input type="number" min="0" step="any" data-faction="${unit.faction}" data-index="${index}" data-path="${path}" value="${readPath(unit, path)}" /></label>
  `).join('');
  const metrics = metricValues(unit);
  return `<article class="unit-card ${unit.faction}" data-unit-id="${unit.id}">
    <div class="unit-heading"><h2>${escapeHtml(unit.name)}</h2><span class="unit-id">${unit.id}</span></div>
    <div class="fields">${fields}</div>
    <div class="metrics">
      <span class="metric">DPS<strong data-metric="dps">${metrics.dps}</strong></span>
      <span class="metric">HP / 비용<strong data-metric="hpCost">${metrics.hpCost}</strong></span>
      <span class="metric">DPS / 비용<strong data-metric="dpsCost">${metrics.dpsCost}</strong></span>
    </div>
  </article>`;
}

function render(): void {
  const byTier = (faction: 'semicon' | 'orchard', tier: number): [EditableUnit, number] => {
    const index = documents[faction].units.findIndex((unit) => unit.tier === tier);
    const unit = documents[faction].units[index];
    if (!unit) throw new Error(`${faction} tier ${tier} is missing.`);
    return [unit, index];
  };
  editor.innerHTML = Array.from({ length: 9 }, (_, offset) => {
    const tier = offset + 1;
    const [semicon, semiconIndex] = byTier('semicon', tier);
    const [orchard, orchardIndex] = byTier('orchard', tier);
    return `<section class="tier-pair">
      <div class="tier-title"><span class="tier-number">T${tier}</span> SAME-TIER COMPARISON</div>
      <div class="pair-content">${unitCard(semicon, semiconIndex)}${unitCard(orchard, orchardIndex)}</div>
    </section>`;
  }).join('');
  updateValidation();
}

function updateCardMetrics(card: HTMLElement, unit: EditableUnit): void {
  const metric = metricValues(unit);
  for (const key of ['dps', 'hpCost', 'dpsCost'] as const) {
    const target = card.querySelector<HTMLElement>(`[data-metric="${key}"]`);
    if (target) target.textContent = metric[key];
  }
}

function updateValidation(): void {
  const errors: string[] = [];
  for (const faction of ['semicon', 'orchard'] as const) {
    if (!validateUnits(documents[faction])) {
      errors.push(...(validateUnits.errors ?? []).map((issue) => `${faction}${issue.instancePath}: ${issue.message ?? issue.keyword}`));
    }
    const sorted = [...documents[faction].units].sort((a, b) => a.tier - b.tier);
    for (let index = 1; index < sorted.length; index += 1) {
      if ((sorted[index]?.cost ?? 0) < (sorted[index - 1]?.cost ?? 0)) errors.push(`${faction}: T${sorted[index]?.tier} 비용이 이전 티어보다 낮습니다.`);
    }
  }
  status.textContent = errors.length === 0 ? 'VALID · 내보내기 가능' : `INVALID · ${errors.length}개 문제`;
  status.className = errors.length === 0 ? 'valid' : 'invalid';
  messages.innerHTML = errors.length === 0 ? '' : `<ul>${errors.slice(0, 8).map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>`;
}

function exportDocument(faction: 'semicon' | 'orchard'): void {
  updateValidation();
  if (status.classList.contains('invalid')) {
    window.alert('검증 오류를 먼저 해결해 주세요.');
    return;
  }
  const blob = new Blob([`${JSON.stringify(documents[faction], null, 2)}\n`], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${faction}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

editor.addEventListener('input', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const faction = input.dataset.faction as 'semicon' | 'orchard';
  const index = Number(input.dataset.index);
  const path = input.dataset.path;
  const unit = documents[faction]?.units[index];
  if (!unit || !path) return;
  writePath(unit, path, Number(input.value));
  const card = input.closest<HTMLElement>('.unit-card');
  if (card) updateCardMetrics(card, unit);
  updateValidation();
});

document.querySelector('#reset')?.addEventListener('click', () => { documents = structuredClone(original); render(); });
document.querySelector('#export-semicon')?.addEventListener('click', () => exportDocument('semicon'));
document.querySelector('#export-orchard')?.addEventListener('click', () => exportDocument('orchard'));

function load(): void {
  original = {
    semicon: semiconSource as unknown as UnitDocument,
    orchard: orchardSource as unknown as UnitDocument
  };
  documents = structuredClone(original);
  render();
}

try {
  load();
} catch (cause) {
  status.textContent = 'LOAD FAILED';
  status.className = 'invalid';
  messages.textContent = cause instanceof Error ? cause.message : String(cause);
}
