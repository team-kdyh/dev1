import stagesJson from '../data/campaign/stages.json';
import researchJson from '../data/meta/research_tree.json';
import { loadProgress, saveProgress } from '../data/progress';
import { button, el, uiRoot } from './dom';
import { assetUrl } from '../assets/assetUrl';

export type CampaignStage = (typeof stagesJson.stages)[number];

export class FactionScreen {
  private readonly node = el('div', 'sw-screen');

  constructor(onChoose: (faction: 'semicon' | 'orchard') => void, onClose: () => void) {
    this.node.append(el('h1', 'sw-title', '진영 선택'));
    this.node.append(el('p', 'sw-sub', '제품 군단을 골라 전장에 출격하세요'));
    const choices = el('div', 'sw-faction-grid');
    for (const [faction, name, note, filename] of [
      ['semicon', '삼성 · 갤럭시', '삼성 제품 군단 · 견고한 전선', 'game-ui/semicon-base.png'],
      ['orchard', '애플 · 아이폰', '애플 제품 군단 · 빠른 공세', 'game-ui/orchard-base.png'],
    ] as const) {
      const card = el('button', `sw-faction-card sw-${faction}`);
      card.type = 'button';
      const image = document.createElement('img');
      image.src = assetUrl(filename);
      image.alt = `${name} 본진`;
      card.append(image, el('strong', undefined, name), el('small', undefined, note));
      card.addEventListener('click', () => onChoose(faction));
      choices.append(card);
    }
    this.node.append(choices, button('뒤로', onClose));
  }

  mount(): void { uiRoot().append(this.node); }
  unmount(): void { this.node.remove(); }
}

export class CampaignScreen {
  private readonly node = el('div', 'sw-screen');

  constructor(onChoose: (stage: CampaignStage) => void, onClose: () => void) {
    const progress = loadProgress();
    const panel = el('div', 'sw-panel');
    const head = el('div', 'sw-panel-head');
    head.append(el('h2', undefined, '캠페인'), button('뒤로', onClose));
    const body = el('div', 'sw-panel-body');
    const grid = el('div', 'sw-grid');
    stagesJson.stages.forEach((stage, index) => {
      const card = el('div', `sw-card sw-stage-card sw-stage-${stage.faction}`);
      const title = el('div', 'sw-card-head');
      title.append(el('span', 'sw-chip', String(index + 1).padStart(2, '0')));
      title.append(el('div', 'sw-card-name', stage.name));
      card.append(title);
      card.append(el('div', 'sw-missing', (stage.faction === 'semicon' ? '삼성' : '애플') + ' · ' + stage.desc));
      const unlocked = stage.unlockRequires.every((id) => progress.cleared.includes(id));
      const play = button(progress.cleared.includes(stage.id) ? '다시 플레이' : '시작', () => onChoose(stage));
      play.disabled = !unlocked;
      card.append(play);
      grid.append(card);
    });
    body.append(grid);
    panel.append(head, body);
    this.node.append(panel);
  }

  mount(): void { uiRoot().append(this.node); }
  unmount(): void { this.node.remove(); }
}

export class ResearchScreen {
  private readonly node = el('div', 'sw-screen');
  private readonly grid = el('div', 'sw-grid');
  private readonly balance = el('div', 'sw-sub');
  private storageWarning = false;

  constructor(onClose: () => void) {
    const panel = el('div', 'sw-panel');
    const head = el('div', 'sw-panel-head');
    head.append(el('h2', undefined, '연구소'), button('뒤로', onClose));
    const body = el('div', 'sw-panel-body');
    body.append(this.balance, this.grid);
    panel.append(head, body);
    this.node.append(panel);
    this.render();
  }

  private render(): void {
    const progress = loadProgress();
    this.balance.textContent = '보유 RP: ' + progress.rp +
      (this.storageWarning ? ' · 저장소에 기록하지 못했습니다. 이 탭을 닫으면 진행이 사라질 수 있습니다.' : '');
    this.grid.replaceChildren();
    for (const node of researchJson.nodes) {
      const level = progress.research[node.id] ?? 0;
      const next = node.levels[level];
      const prerequisitesMet = node.requires.every((id) => (progress.research[id] ?? 0) > 0);
      const card = el('div', 'sw-card');
      card.append(el('div', 'sw-card-name', node.name + '  ' + level + '/' + node.levels.length));
      card.append(el('div', 'sw-missing', node.faction === 'semicon' ? '삼성' : '애플'));
      if (!prerequisitesMet) {
        const names = node.requires.map((id) => researchJson.nodes.find((entry) => entry.id === id)?.name ?? id);
        card.append(el('div', 'sw-missing', '선행 연구: ' + names.join(', ')));
      }
      const purchase = button(next ? '연구 ' + next.cost + ' RP' : '최대 레벨', () => {
        const current = loadProgress();
        const currentLevel = current.research[node.id] ?? 0;
        const price = node.levels[currentLevel]?.cost;
        if (price === undefined || current.rp < price ||
          !node.requires.every((id) => (current.research[id] ?? 0) > 0)) return;
        current.rp -= price;
        current.research[node.id] = currentLevel + 1;
        this.storageWarning = !saveProgress(current);
        this.render();
      });
      purchase.disabled = !next || progress.rp < next.cost || !prerequisitesMet;
      card.append(purchase);
      this.grid.append(card);
    }
  }

  mount(): void { uiRoot().append(this.node); }
  unmount(): void { this.node.remove(); }
}
