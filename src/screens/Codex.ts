import type { BalanceData, UnitDef } from '../sim/contracts';
import { FACTION_COLOR } from '../render/textures';
import { button, el, uiRoot } from './dom';

/**
 * 도감. (명세 §7)
 *
 * "C의 밸런스 JSON을 하드코딩 없이 렌더링한다" — 이 파일에 유닛 이름도 숫자도 없다.
 * 스킬·상성은 BalanceData에 아직 필드가 없어 "데이터 없음"으로 표시한다.
 * C가 필드를 추가하면 여기서 자동으로 그려진다.
 */
export class Codex {
  private readonly node = el('div', 'sw-screen');
  private readonly grid = el('div', 'sw-grid');
  private factionFilter: string | null = null;
  private tierFilter: number | null = null;

  constructor(
    private readonly balance: BalanceData,
    onClose: () => void,
  ) {
    const panel = el('div', 'sw-panel');
    const head = el('div', 'sw-panel-head');
    const title = el('h2', undefined, '도감');

    head.append(title);

    // 진영 필터
    const factions = [...new Set(this.balance.units.map((u) => u.faction))];
    for (const faction of factions) {
      const chip = el('button', 'sw-filter', faction);
      chip.addEventListener('click', () => {
        this.factionFilter = this.factionFilter === faction ? null : faction;
        this.refresh(head);
      });
      chip.dataset.faction = faction;
      head.append(chip);
    }

    // 티어 필터
    const tiers = [...new Set(this.balance.units.map((u) => u.tier))].sort((a, b) => a - b);
    for (const tier of tiers) {
      const chip = el('button', 'sw-filter', `T${tier}`);
      chip.addEventListener('click', () => {
        this.tierFilter = this.tierFilter === tier ? null : tier;
        this.refresh(head);
      });
      chip.dataset.tier = String(tier);
      head.append(chip);
    }

    head.append(button('닫기', onClose));

    const body = el('div', 'sw-panel-body');
    body.append(this.grid);
    panel.append(head, body);
    this.node.append(panel);

    this.refresh(head);
  }

  private refresh(head: HTMLElement): void {
    for (const chip of Array.from(head.querySelectorAll<HTMLElement>('.sw-filter'))) {
      const on =
        (chip.dataset.faction !== undefined && chip.dataset.faction === this.factionFilter) ||
        (chip.dataset.tier !== undefined && Number(chip.dataset.tier) === this.tierFilter);
      chip.dataset.on = on ? '1' : '0';
    }

    this.grid.replaceChildren();
    const units = this.balance.units
      .filter((u) => (this.factionFilter ? u.faction === this.factionFilter : true))
      .filter((u) => (this.tierFilter ? u.tier === this.tierFilter : true))
      .sort((a, b) => a.faction.localeCompare(b.faction) || a.tier - b.tier);

    for (const unit of units) this.grid.append(this.card(unit));
  }

  private card(unit: UnitDef): HTMLElement {
    const card = el('div', 'sw-card');

    const head = el('div', 'sw-card-head');
    head.append(el('span', 'sw-chip', `${unit.faction} T${unit.tier}`));
    head.append(el('span', 'sw-card-name', unit.name));

    // 애니메이션 프리뷰 — 정식 아틀라스 전까지는 플레이스홀더와 같은 규칙의 도형을 움직인다
    card.append(head, this.preview(unit));

    const stats = el('ul', 'sw-stats');
    const rows: [string, string][] = [
      ['비용', String(unit.cost)],
      ['인구', String(unit.supply)],
      ['HP', String(unit.hp)],
      ['DPS', String(unit.dps)],
      ['사거리', String(unit.range)],
      ['이동속도', unit.speed.toFixed(1)],
      ['생산시간', `${(unit.buildMs / 1000).toFixed(1)}s`],
      ['쿨다운', `${(unit.cooldownMs / 1000).toFixed(1)}s`],
    ];
    for (const [key, value] of rows) {
      const li = el('li');
      li.append(el('span', undefined, key));
      const b = el('b', undefined, value);
      li.append(b);
      stats.append(li);
    }
    card.append(stats);

    // 스킬·상성은 BalanceData에 필드가 없다. 지어내지 않고 없다고 적는다.
    const extra = unit as unknown as { skills?: unknown[]; counters?: unknown[] };
    if (!extra.skills && !extra.counters) {
      card.append(el('div', 'sw-missing', '스킬 · 상성: 밸런스 데이터에 필드 없음'));
    }

    return card;
  }

  private preview(unit: UnitDef): SVGSVGElement {
    const color = FACTION_COLOR[unit.faction] ?? 0x888888;
    const hex = `#${color.toString(16).padStart(6, '0')}`;
    const w = 30 + unit.tier * 4;
    const h = 40 + unit.tier * 9;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'sw-preview');
    svg.setAttribute('viewBox', '0 0 200 76');

    const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    body.setAttribute('width', String(w * 0.6));
    body.setAttribute('height', String(h * 0.6));
    body.setAttribute('rx', '3');
    body.setAttribute('fill', hex);
    body.setAttribute('y', String(70 - h * 0.6));

    // move 애니메이션 프리뷰 (§8: move 6프레임, 12fps ≈ 0.5초 주기)
    const move = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
    move.setAttribute('attributeName', 'x');
    move.setAttribute('values', '10;170;10');
    move.setAttribute('dur', `${(12 / unit.speed).toFixed(1)}s`);
    move.setAttribute('repeatCount', 'indefinite');
    body.append(move);

    const ground = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    ground.setAttribute('x', '0');
    ground.setAttribute('y', '70');
    ground.setAttribute('width', '200');
    ground.setAttribute('height', '2');
    ground.setAttribute('fill', '#2a2f3d');

    svg.append(ground, body);
    return svg;
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}
