import { Container, Graphics, Text } from 'pixi.js';
import type { BalanceData, Command, PlayerSnapshot } from '../sim/contracts';
import { COLOR, UI_FONT, UI_MONO } from './theme';

/** 공통 패널 배경 */
function panel(width: number, height: number): Graphics {
  const g = new Graphics();
  g.roundRect(0, 0, width, height, 10).fill({ color: COLOR.panel, alpha: 0.96 });
  g.roundRect(0, 0, width, height, 10).stroke({ width: 2, color: COLOR.panelEdge, alignment: 1 });
  return g;
}

function label(text: string, size: number, color: number): Text {
  return new Text({
    text,
    style: { fontFamily: UI_FONT, fontSize: size, fill: color },
  });
}

/** 작은 클릭 버튼 */
class TextButton {
  readonly root = new Container();
  private readonly bg: Graphics;
  private readonly caption: Text;
  private enabled = true;

  constructor(text: string, width: number, height: number, onPress: () => void) {
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, width, height, 6).fill(0x1d2740);
    this.bg.roundRect(0, 0, width, height, 6).stroke({ width: 1, color: COLOR.panelEdge, alignment: 1 });

    this.caption = label(text, 14, COLOR.text);
    this.caption.anchor.set(0.5);
    this.caption.position.set(width / 2, height / 2);

    this.root.addChild(this.bg, this.caption);
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
    // 반응성: 누를 때 시각 반응 (§5)
    this.root.on('pointerdown', () => this.root.scale.set(0.96));
    this.root.on('pointerup', () => this.root.scale.set(1));
    this.root.on('pointerupoutside', () => this.root.scale.set(1));
    this.root.on('pointertap', () => {
      if (this.enabled) onPress();
    });
  }

  setText(text: string): void {
    this.caption.text = text;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.root.alpha = enabled ? 1 : 0.45;
  }
}

/**
 * 업그레이드 패널. (§4, §5 R 토글)
 *
 * BalanceData에 업그레이드 목록 필드가 아직 없다. §7의 "하드코딩 없이 렌더링" 원칙에 따라
 * 임의의 항목을 지어내지 않고, 데이터가 오면 그대로 그려지도록 비워 둔다.
 */
export class UpgradePanel {
  readonly root = new Container();
  private readonly body = new Container();
  private readonly w = 320;
  private readonly h = 220;
  private x = 0;
  private y = 0;

  constructor(
    private readonly balance: BalanceData,
    private readonly send: (cmd: Command) => void,
  ) {
    const bg = panel(this.w, this.h);
    const title = label('업그레이드  [R]', 16, COLOR.text);
    title.position.set(16, 14);
    this.root.addChild(bg, title, this.body);
    this.body.position.set(16, 46);
    this.root.visible = false;
    this.root.eventMode = 'static';
    this.rebuild();
  }

  private rebuild(): void {
    this.body.removeChildren();
    const upgrades = (this.balance as { upgrades?: readonly { id: string; name: string; cost: number }[] })
      .upgrades;

    if (!upgrades || upgrades.length === 0) {
      const empty = label('C의 밸런스 데이터에 업그레이드 항목이 없습니다.', 12, COLOR.textDim);
      empty.position.set(0, 0);
      const note = label('데이터가 들어오면 여기에 자동으로 표시됩니다.', 12, COLOR.textDim);
      note.position.set(0, 20);
      this.body.addChild(empty, note);
      return;
    }

    upgrades.forEach((upgrade, i) => {
      const button = new TextButton(`${upgrade.name}  ${upgrade.cost}`, this.w - 32, 30, () =>
        this.send({ type: 'BUY_UPGRADE', upgradeId: upgrade.id }),
      );
      button.root.position.set(0, i * 36);
      this.body.addChild(button.root);
    });
  }

  toggle(): void {
    this.root.visible = !this.root.visible;
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  layout(screenW: number, screenH: number): void {
    this.x = Math.round((screenW - this.w) / 2);
    this.y = Math.round((screenH - this.h) / 2);
    this.root.position.set(this.x, this.y);
  }

  hitTest(px: number, py: number): boolean {
    if (!this.root.visible) return false;
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

/** 시대 업그레이드 버튼 (§4 시대, §5 E) */
export class AgeUpButton {
  readonly root = new Container();
  private readonly button: TextButton;
  private x = 0;
  private y = 0;
  private readonly w = 120;
  private readonly h = 34;

  constructor(
    private readonly balance: BalanceData,
    send: (cmd: Command) => void,
  ) {
    this.button = new TextButton('E  시대 업', this.w, this.h, () => send({ type: 'AGE_UP' }));
    this.root.addChild(this.button.root);
  }

  layout(screenW: number, screenH: number, bottomMargin: number): void {
    this.x = 14 + 96 + 10;
    this.y = screenH - this.h - bottomMargin;
    this.root.position.set(this.x, this.y);
  }

  update(player: PlayerSnapshot): void {
    const cost = this.balance.ageUpCost[player.age];
    if (cost === undefined) {
      this.button.setText('최종 시대');
      this.button.setEnabled(false);
      return;
    }
    this.button.setText(`E  시대 업 ${cost}`);
    this.button.setEnabled(player.cash >= cost);
  }

  hitTest(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

/** 일시정지 메뉴 (§4, §5 ESC). PvP에서는 비활성 — M3에서 NetSimAdapter가 막는다. */
export class PauseMenu {
  readonly root = new Container();
  private readonly w = 260;
  private readonly h = 160;
  private x = 0;
  private y = 0;

  constructor(onResume: () => void, onQuit: () => void) {
    const bg = panel(this.w, this.h);
    const title = label('일시정지', 20, COLOR.text);
    title.anchor.set(0.5, 0);
    title.position.set(this.w / 2, 20);

    const resume = new TextButton('계속하기', this.w - 48, 34, onResume);
    resume.root.position.set(24, 62);
    const quit = new TextButton('메인 메뉴로', this.w - 48, 34, onQuit);
    quit.root.position.set(24, 104);

    this.root.addChild(bg, title, resume.root, quit.root);
    this.root.visible = false;
    this.root.eventMode = 'static';
  }

  layout(screenW: number, screenH: number): void {
    this.x = Math.round((screenW - this.w) / 2);
    this.y = Math.round((screenH - this.h) / 2);
    this.root.position.set(this.x, this.y);
  }

  toggle(): void {
    this.root.visible = !this.root.visible;
  }

  close(): void {
    this.root.visible = false;
  }

  get isOpen(): boolean {
    return this.root.visible;
  }

  hitTest(px: number, py: number): boolean {
    if (!this.root.visible) return false;
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }
}

/** 유닛 정보 팝업 (§5 길게 누르기 / 우클릭) */
export class UnitInfoPopup {
  readonly root = new Container();
  private readonly body = new Container();
  private readonly w = 200;
  private readonly h = 130;

  constructor() {
    const bg = panel(this.w, this.h);
    this.root.addChild(bg, this.body);
    this.body.position.set(14, 12);
    this.root.visible = false;
    this.root.eventMode = 'none';
  }

  /** 스탯은 전부 BalanceData에서 온다 — 숫자를 UI에 적지 않는다 (§7) */
  show(
    screenX: number,
    screenY: number,
    screenW: number,
    screenH: number,
    def: { name: string; tier: number; cost: number; supply: number; hp: number; dps: number; range: number; speed: number },
  ): void {
    this.body.removeChildren();
    const title = label(`${def.name}`, 15, COLOR.text);
    this.body.addChild(title);

    const rows = [
      ['티어', String(def.tier)],
      ['비용 / 인구', `${def.cost} / ${def.supply}`],
      ['HP / DPS', `${def.hp} / ${def.dps}`],
      ['사거리 / 속도', `${def.range} / ${def.speed.toFixed(1)}`],
    ];
    rows.forEach(([key, value], i) => {
      const k = new Text({ text: key, style: { fontFamily: UI_FONT, fontSize: 11, fill: COLOR.textDim } });
      k.position.set(0, 26 + i * 18);
      const v = new Text({ text: value, style: { fontFamily: UI_MONO, fontSize: 11, fill: COLOR.text } });
      v.anchor.set(1, 0);
      v.position.set(this.w - 28, 26 + i * 18);
      this.body.addChild(k, v);
    });

    this.root.position.set(
      Math.min(Math.max(8, screenX - this.w / 2), screenW - this.w - 8),
      Math.min(Math.max(8, screenY - this.h - 16), screenH - this.h - 8),
    );
    this.root.visible = true;
  }

  hide(): void {
    this.root.visible = false;
  }
}
