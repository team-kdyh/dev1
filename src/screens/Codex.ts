import type { BalanceData, UnitDef } from '../sim/contracts';
import semiconSkills from '../data/balance/skills/semicon.json';
import orchardSkills from '../data/balance/skills/orchard.json';
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
    const number = (value: number): string => new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 1,
    }).format(value);
    const rows: [string, string][] = [
      ['비용', number(unit.cost)],
      ['인구', number(unit.supply)],
      ['HP', number(unit.hp)],
      ['DPS', number(unit.dps)],
      ['사거리', number(unit.range)],
      ['이동속도', number(unit.speed)],
      ['생산시간', `${number(unit.buildMs / 1000)}s`],
      ['쿨다운', `${number(unit.cooldownMs / 1000)}s`],
    ];
    for (const [key, value] of rows) {
      const li = el('li');
      li.append(el('span', undefined, key));
      const b = el('b', undefined, value);
      li.append(b);
      stats.append(li);
    }
    card.append(stats);

    if (unit.description) card.append(el('div', 'sw-missing', unit.description));
    const catalog = [...semiconSkills.skills, ...orchardSkills.skills];
    const names = unit.skills?.map((id) => catalog.find((skill) => skill.id === id)?.name ?? id) ?? [];
    if (names.length > 0) card.append(el('div', 'sw-missing', '스킬: ' + names.join(' · ')));

    return card;
  }

  private preview(unit: UnitDef): HTMLImageElement {
    const image = document.createElement('img');
    image.className = 'sw-preview';
    image.alt = unit.name;
    image.style.objectFit = 'contain';
    image.src = '/assets/frames/units/' + unit.faction + '/' + unit.artId + '_idle_00.png';
    return image;
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}
