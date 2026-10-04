import { button, el, uiRoot } from './dom';
import { loadAudioSettings, saveAudioSettings, type AudioSettings } from '../audio/settings';
import { assetUrl } from '../assets/assetUrl';

/** §7 스플래시 */
export class Splash {
  private readonly node = el('div', 'sw-screen');

  constructor(onDone: () => void, holdMs = 1100) {
    this.node.append(el('h1', 'sw-title', 'TECH WAR'));
    this.node.append(el('p', 'sw-sub', '불러오는 중…'));
    window.setTimeout(onDone, holdMs);
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}

export interface MainMenuActions {
  campaign: () => void;
  quickMatch: () => void;
  codex: () => void;
  lab: () => void;
  settings: () => void;
}

/** PvE 메뉴. 온라인 대전은 서버가 준비된 별도 단계에서 노출한다. */
export class MainMenu {
  private readonly node = el('div', 'sw-screen sw-home');

  constructor(actions: MainMenuActions) {
    this.node.append(el('div', 'sw-eyebrow', 'PRODUCT BATTLE · SIDE SCROLL STRATEGY'));
    this.node.append(el('h1', 'sw-title', 'TECH WAR'));
    this.node.append(el('p', 'sw-sub', '삼성 vs 애플 · 제품 군단의 한 줄 전쟁'));

    const stage = el('div', 'sw-home-stage');
    for (const [faction, filename] of [
      ['blue', 'semicon/semicon_t3_aphone_soldier_idle_00.png'],
      ['coral', 'orchard/orchard_t3_phone_idle_00.png'],
    ] as const) {
      const figure = el('div', `sw-fighter sw-fighter-${faction}`);
      const image = document.createElement('img');
      image.src = assetUrl(`frames/units/${filename}`);
      image.alt = faction === 'blue' ? '삼성 진영 캐릭터' : '애플 진영 캐릭터';
      figure.append(image);
      if (faction === 'coral') stage.append(el('div', 'sw-versus', 'VS'));
      stage.append(figure);
    }
    this.node.append(stage);

    const menu = el('div', 'sw-menu');
    menu.append(button('캠페인', actions.campaign));
    menu.append(button('빠른 대전', actions.quickMatch));
    menu.append(button('도감', actions.codex));
    menu.append(button('연구소', actions.lab));

    menu.append(button('설정', actions.settings));
    this.node.append(menu);
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}

export interface MatchResult {
  outcome: 'win' | 'lose' | 'draw';
  elapsedMs: number;
  produced: number;
  killed: number;
  /** 최대 전선 — 논리 좌표 기준으로 아군이 가장 멀리 밀어낸 지점 */
  maxFrontline: number;
  rp: number | null;
  storageWarning?: boolean;
}

/** §7 결과 화면: 승패, 시간, 생산·처치 수, 최대 전선, RP */
export class ResultScreen {
  private readonly node = el('div', 'sw-screen sw-transparent');

  constructor(result: MatchResult, onAgain: () => void, onMenu: () => void) {
    const verdictText = { win: '승리', lose: '패배', draw: '무승부' }[result.outcome];
    const verdict = el('h1', `sw-verdict sw-${result.outcome}`, verdictText);
    this.node.append(verdict);

    const totalSec = Math.floor(result.elapsedMs / 1000);
    const time = `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;

    const rows: [string, string][] = [
      ['시간', time],
      ['생산 유닛', String(result.produced)],
      ['처치', String(result.killed)],
      ['최대 전선', `${Math.round(result.maxFrontline)} / 1000`],
      ['RP', result.rp === null ? '데이터 없음' : String(result.rp)],
    ];

    const list = el('ul', 'sw-result-rows');
    for (const [key, value] of rows) {
      const li = el('li');
      li.append(el('span', undefined, key));
      li.append(el('b', undefined, value));
      list.append(li);
    }
    this.node.append(list);
    if (result.storageWarning) {
      this.node.append(el('p', 'sw-sub', '진행을 저장소에 기록하지 못했습니다. 이 탭을 닫으면 진행이 사라질 수 있습니다.'));
    }

    const menu = el('div', 'sw-menu');
    menu.append(button('다시 하기', onAgain));
    menu.append(button('메인 메뉴', onMenu));

    this.node.append(menu);
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}

/** §7 설정 / 연구소 — 명세에 항목이 정해져 있지 않아 자리만 만든다 */
export class PlaceholderScreen {
  private readonly node = el('div', 'sw-screen');

  constructor(title: string, note: string, onClose: () => void) {
    this.node.append(el('h1', 'sw-title', title));
    this.node.append(el('p', 'sw-sub', note));
    const menu = el('div', 'sw-menu');
    menu.append(button('뒤로', onClose));
    this.node.append(menu);
  }

  mount(): void {
    uiRoot().append(this.node);
  }

  unmount(): void {
    this.node.remove();
  }
}

/** 전투 음량은 브라우저에 저장하고 다음 경기부터 적용한다. */
export class SettingsScreen {
  private readonly node = el('div', 'sw-screen');

  constructor(onClose: () => void) {
    const settings = loadAudioSettings();
    const panel = el('div', 'sw-panel sw-settings');
    const head = el('div', 'sw-panel-head');
    head.append(el('h2', undefined, '설정'), button('뒤로', onClose));
    const body = el('div', 'sw-panel-body');
    body.append(el('p', 'sw-settings-lead', '게임 사운드를 원하는 크기로 조절하세요.'));

    for (const [key, title] of [
      ['music', '전투 음악'], ['effects', '효과음'],
    ] as const satisfies readonly (readonly [keyof AudioSettings, string])[]) {
      const row = el('label', 'sw-setting-row');
      const name = el('strong', undefined, title);
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = String(Math.round(settings[key] * 100));
      slider.setAttribute('aria-label', title);
      const value = el('output', undefined, `${slider.value}%`);
      slider.addEventListener('input', () => {
        settings[key] = Number(slider.value) / 100;
        value.textContent = `${slider.value}%`;
        saveAudioSettings(settings);
      });
      row.append(name, slider, value);
      body.append(row);
    }

    body.append(el('p', 'sw-settings-tip',
      '조작: 숫자키 1~9 생산 · Q/W 전략 · E 시대 · R 업그레이드 · 스페이스 전선 복귀'));
    panel.append(head, body);
    this.node.append(panel);
  }

  mount(): void { uiRoot().append(this.node); }
  unmount(): void { this.node.remove(); }
}
