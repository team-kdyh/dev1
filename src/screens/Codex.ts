import type { BalanceData, UnitDef } from '../sim/contracts';
import { getUnitPreviewFrame } from '../render/unitAssets';
import { button, el, uiRoot } from './dom';

/**
 * 도감. (명세 §7)
 *
 * "C의 밸런스 JSON을 하드코딩 없이 렌더링한다" — 이 파일에 유닛 이름도 숫자도 없다.
 * C의 설명·역할·스킬과 D의 실제 캐릭터 아틀라스를 같은 ID로 연결한다.
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

    // 전투 화면과 동일한 D 아틀라스의 캐릭터를 보여준다.
    card.append(head, this.preview(unit));
    card.append(el('p', 'sw-unit-desc', unit.description));

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

    const tags = el('div', 'sw-unit-tags');
    for (const role of unit.roles) tags.append(el('span', 'sw-role', role));
    card.append(tags);

    const skills = el('div', 'sw-skill-list');
    skills.append(el('b', undefined, '스킬'));
    skills.append(el('span', undefined, unit.skills.length > 0 ? unit.skills.join(' · ') : '기본 공격'));
    card.append(skills);

    return card;
  }

  private preview(unit: UnitDef): HTMLElement {
    const preview = el('div', 'sw-preview');
    const source = getUnitPreviewFrame(unit.id);
    if (!source) {
      preview.append(el('span', 'sw-preview-missing', '캐릭터 이미지 없음'));
      return preview;
    }

    const figure = el('div', 'sw-preview-figure');
    const scale = unit.tier >= 7 ? 0.56 : 0.76;
    figure.style.width = `${source.sourceSize.w}px`;
    figure.style.height = `${source.sourceSize.h}px`;
    figure.style.transform = `translateX(-50%) scale(${scale})`;

    const sprite = el('div', 'sw-preview-sprite');
    sprite.style.left = `${source.spriteSourceSize.x}px`;
    sprite.style.top = `${source.spriteSourceSize.y}px`;
    sprite.style.width = `${source.frame.w}px`;
    sprite.style.height = `${source.frame.h}px`;
    sprite.style.backgroundImage = `url("${source.imageUrl}")`;
    sprite.style.backgroundPosition = `-${source.frame.x}px -${source.frame.y}px`;

    figure.append(sprite);
    preview.append(figure);
    return preview;
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}
