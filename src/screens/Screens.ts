import { button, el, uiRoot } from './dom';

/** §7 스플래시 */
export class Splash {
  private readonly node = el('div', 'sw-screen');

  constructor(onDone: () => void, holdMs = 1100) {
    this.node.append(el('h1', 'sw-title', 'STICK WAR'));
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
  online: () => void;
  settings: () => void;
}

/** §7 메인메뉴 → 캠페인/빠른대전/도감/연구소/온라인 대전(M3)/설정 */
export class MainMenu {
  private readonly node = el('div', 'sw-screen');

  constructor(actions: MainMenuActions) {
    this.node.append(el('h1', 'sw-title', 'STICK WAR'));
    this.node.append(el('p', 'sw-sub', 'Track A — 클라이언트'));

    const menu = el('div', 'sw-menu');
    menu.append(button('캠페인', actions.campaign));
    menu.append(button('빠른 대전', actions.quickMatch));
    menu.append(button('도감', actions.codex));
    menu.append(button('연구소', actions.lab));

    const online = button('온라인 대전', actions.online);
    online.disabled = true;
    online.title = 'M3에서 열립니다';
    menu.append(online);

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
  won: boolean;
  elapsedMs: number;
  produced: number;
  killed: number;
  /** 최대 전선 — 논리 좌표 기준으로 아군이 가장 멀리 밀어낸 지점 */
  maxFrontline: number;
  rp: number | null;
}

/** §7 결과 화면: 승패, 시간, 생산·처치 수, 최대 전선, RP */
export class ResultScreen {
  private readonly node = el('div', 'sw-screen sw-transparent');

  constructor(result: MatchResult, onAgain: () => void, onMenu: () => void) {
    const verdict = el('h1', `sw-verdict ${result.won ? 'sw-win' : 'sw-lose'}`, result.won ? '승리' : '패배');
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

    const menu = el('div', 'sw-menu');
    menu.append(button('다시 하기', onAgain));
    menu.append(button('메인 메뉴', onMenu));

    // M3 리플레이 저장 — 리플레이 데이터가 없으므로 비활성
    const replay = button('리플레이 저장', () => {});
    replay.disabled = true;
    replay.title = 'M3에서 열립니다';
    menu.append(replay);

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
