import { Container } from 'pixi.js';
import type { BalanceData, Command, PlayerId, SimEvent, Snapshot, UnitDef } from '../sim/contracts';
import { FACTION_OF_PLAYER } from '../data/gameData';
import { Minimap } from './Minimap';
import { AgeUpButton, PauseMenu, StrategyButtons, UnitInfoPopup, UpgradePanel } from './Panels';
import { QueueBar } from './QueueBar';
import { ResourceBar } from './ResourceBar';
import { REJECT_TEXT, ToastStack } from './ToastStack';
import { BAR_MARGIN, BUTTON_H } from './theme';
import { UnitBar } from './UnitBar';
import { Warnings } from './Warnings';
import type { Camera } from '../render/Camera';

export interface HudCallbacks {
  send: (cmd: Command) => void;
  onPauseToggle: (paused: boolean) => void;
  onQuit: () => void;
}

/**
 * HUD 루트. (§2.3 레이어 9 — 카메라를 따라가지 않는 고정 컨테이너)
 * §4의 캐시·인구·시대·본진 HP·타이머·전략 버튼·유닛 버튼·생산 큐·업그레이드·일시정지를 모두 담는다.
 */
export class Hud {
  readonly root = new Container();

  private readonly warnings = new Warnings();
  private readonly resources = new ResourceBar();
  private readonly unitBar: UnitBar;
  private readonly queueBar: QueueBar;
  private readonly minimap: Minimap;
  private readonly strategy: StrategyButtons;
  private readonly ageUp: AgeUpButton;
  private readonly upgrades: UpgradePanel;
  private readonly pause: PauseMenu;
  private readonly info = new UnitInfoPopup();
  private readonly toasts = new ToastStack();

  constructor(
    stage: Container,
    balance: BalanceData,
    private readonly me: PlayerId,
    camera: Camera,
    private readonly callbacks: HudCallbacks,
  ) {
    this.unitBar = new UnitBar(balance, FACTION_OF_PLAYER[me], balance.queueMax, (def: UnitDef) => {
      // 판정과 무관하게 항상 보낸다. 거부는 시뮬의 몫 (§4.1)
      callbacks.send({ type: 'SPAWN_UNIT', defId: def.id });
    });
    this.queueBar = new QueueBar(balance, (index) => {
      // 환불 80%는 시뮬이 처리한다 (§4.2)
      callbacks.send({ type: 'CANCEL_QUEUE', index });
    });
    this.minimap = new Minimap(camera);
    this.strategy = new StrategyButtons(balance, FACTION_OF_PLAYER[me], callbacks.send);
    this.ageUp = new AgeUpButton(balance, callbacks.send);
    this.upgrades = new UpgradePanel(balance, callbacks.send);
    this.pause = new PauseMenu(
      () => this.togglePause(),
      () => {
        this.pause.close();
        this.callbacks.onPauseToggle(false);
        this.callbacks.onQuit();
      },
    );

    this.root.addChild(
      this.warnings.root,
      this.resources.root,
      this.unitBar.root,
      this.queueBar.root,
      this.minimap.root,
      this.strategy.root,
      this.ageUp.root,
      this.toasts.root,
      this.upgrades.root,
      this.pause.root,
      this.info.root,
    );
    stage.addChild(this.root);
  }

  resize(width: number, height: number): void {
    const compact = width < 650;
    this.warnings.resize(width, height);
    this.resources.layout(width);
    this.unitBar.layout(width, height, BAR_MARGIN);

    const unitBarTop = height - BUTTON_H - BAR_MARGIN;
    this.queueBar.layout(width, unitBarTop - (compact ? BUTTON_H + 35 : 6));
    this.minimap.layout(width, height, BUTTON_H + BAR_MARGIN + 8);
    this.strategy.layout(width, height, BAR_MARGIN + (compact ? BUTTON_H + 14 : 0));
    this.ageUp.layout(width, height, BAR_MARGIN + (compact ? BUTTON_H + 14 : 0));
    this.toasts.layout(width, height,
      BUTTON_H + BAR_MARGIN + this.queueBar.barHeight + (compact ? 104 : 24));
    this.upgrades.layout(width, height);
    this.pause.layout(width, height);
  }

  update(snapshot: Snapshot, deltaMs: number): void {
    const player = snapshot.players[snapshot.me];
    this.warnings.update(snapshot, deltaMs);
    this.resources.update(snapshot, this.warnings.cashHighlight, deltaMs);
    this.unitBar.update(snapshot, deltaMs);
    this.queueBar.update(player);
    this.minimap.update(snapshot);
    this.ageUp.update(player, snapshot.tick);
    this.strategy.update(player);
    this.upgrades.update(player);
    this.toasts.tick(deltaMs);
  }

  handleEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type !== 'rejected') continue;
      if (event.owner !== undefined && event.owner !== this.me) continue;
      this.toasts.push(REJECT_TEXT[event.reason]);
      if (event.command.type === 'SPAWN_UNIT') {
        this.unitBar.onRejected(event.command.defId, event.reason);
      }
    }
  }

  /** §5 R */
  toggleUpgrades(): void {
    this.upgrades.toggle();
  }

  /** §5 ESC */
  togglePause(): void {
    this.pause.toggle();
    this.callbacks.onPauseToggle(this.pause.isOpen);
  }

  get isPaused(): boolean {
    return this.pause.isOpen;
  }

  /** §5 길게 누르기 / 우클릭 */
  showUnitInfo(screenX: number, screenY: number, screenW: number, screenH: number, def: UnitDef): void {
    this.info.show(screenX, screenY, screenW, screenH, def);
  }

  hideUnitInfo(): void {
    this.info.hide();
  }

  /** 이 좌표가 HUD 위인가 — 카메라 드래그가 HUD에서 시작되는 걸 막는다 */
  hitTest(x: number, y: number): boolean {
    return (
      this.pause.hitTest(x, y) ||
      this.upgrades.hitTest(x, y) ||
      this.unitBar.hitTest(x, y) ||
      this.queueBar.hitTest(x, y) ||
      this.minimap.hitTest(x, y) ||
      this.strategy.hitTest(x, y) ||
      this.ageUp.hitTest(x, y)
    );
  }
}
