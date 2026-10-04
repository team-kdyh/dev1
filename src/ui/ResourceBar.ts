import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { PlayerId, Snapshot } from '../sim/contracts';
import { COLOR, UI_FONT, UI_MONO } from './theme';

const PANEL_W = 236;
const PANEL_H = 94;
const HP_W = 208;
const HP_H = 7;

/** 캐시·인구·시대·본진 HP·타이머. (§4) */
export class ResourceBar {
  readonly root = new Container();

  private readonly panel = new Graphics();
  private readonly foePanel = new Graphics();
  private readonly cashLabel: Text;
  private readonly cash: Text;
  private readonly supply: Text;
  private readonly age: Text;
  private readonly timer: Text;

  private readonly myHpBg = new Sprite(Texture.WHITE);
  private readonly myHpFill = new Sprite(Texture.WHITE);
  private readonly foeHpBg = new Sprite(Texture.WHITE);
  private readonly foeHpFill = new Sprite(Texture.WHITE);
  private readonly foeLabel: Text;

  private readonly foeGroup = new Container();
  private highlightMs = 0;

  constructor(me: PlayerId) {
    const isSemicon = me === 0;
    const allyAccent = isSemicon ? 0x6cc7ff : 0xff9c83;
    const foeAccent = isSemicon ? 0xff9c83 : 0x6cc7ff;
    this.panel.roundRect(0, 0, PANEL_W, PANEL_H, 12).fill({ color: COLOR.panel, alpha: 0.96 });
    this.panel.roundRect(0, 0, PANEL_W, PANEL_H, 12)
      .stroke({ width: 1, color: COLOR.panelEdge, alpha: 0.9, alignment: 1 });
    this.panel.roundRect(13, 10, 4, 36, 2).fill(allyAccent);
    this.panel.roundRect(13, PANEL_H - 14, HP_W, 2, 1)
      .fill({ color: 0x7da4c5, alpha: 0.4 });

    this.cashLabel = new Text({
      text: isSemicon ? 'SAMSUNG / CASH' : 'APPLE / CASH',
      style: { fontFamily: UI_MONO, fontSize: 10, fontWeight: 'bold', fill: COLOR.textDim,
        letterSpacing: 1 },
    });
    this.cashLabel.position.set(24, 10);

    this.cash = new Text({
      text: '0',
      style: { fontFamily: UI_MONO, fontSize: 28, fontWeight: 'bold', fill: COLOR.cash },
    });
    this.cash.position.set(24, 23);

    this.supply = new Text({
      text: '0/0',
      style: { fontFamily: UI_FONT, fontSize: 12, fontWeight: 'bold', fill: COLOR.supply },
    });
    this.supply.position.set(14, 60);

    this.age = new Text({
      text: '시대 1',
      style: { fontFamily: UI_FONT, fontSize: 12, fontWeight: 'bold', fill: COLOR.text },
    });
    this.age.anchor.set(1, 0);
    this.age.position.set(PANEL_W - 14, 60);

    this.timer = new Text({
      text: '00:00',
      style: { fontFamily: UI_MONO, fontSize: 13, fontWeight: 'bold', fill: COLOR.textDim },
    });
    this.timer.anchor.set(1, 0);
    this.timer.position.set(PANEL_W - 14, 15);

    setupBar(this.myHpBg, this.myHpFill, 14, 82);
    this.root.addChild(
      this.panel,
      this.cashLabel,
      this.cash,
      this.supply,
      this.age,
      this.timer,
      this.myHpBg,
      this.myHpFill,
    );

    this.foePanel.roundRect(0, 0, PANEL_W, 52, 12).fill({ color: COLOR.panel, alpha: 0.95 });
    this.foePanel.roundRect(0, 0, PANEL_W, 52, 12)
      .stroke({ width: 1, color: COLOR.panelEdge, alpha: 0.8, alignment: 1 });
    this.foePanel.roundRect(13, 12, 4, 23, 2).fill(foeAccent);
    this.foeLabel = new Text({
      text: isSemicon ? 'APPLE BASE' : 'SAMSUNG BASE',
      style: { fontFamily: UI_MONO, fontSize: 11, fontWeight: 'bold', fill: COLOR.text,
        letterSpacing: 1.2 },
    });
    this.foeLabel.position.set(23, 10);
    setupBar(this.foeHpBg, this.foeHpFill, 14, 38);
    this.foeGroup.addChild(this.foePanel, this.foeLabel, this.foeHpBg, this.foeHpFill);
    this.root.addChild(this.foeGroup);

    this.root.position.set(12, 12);
  }

  layout(screenW: number): void {
    const scale = screenW < 420 ? 0.62 : screenW < 650 ? 0.76 : 1;
    this.root.scale.set(scale);
    this.foeGroup.position.set((screenW - 12) / scale - PANEL_W, 0);
  }

  /** cashHighlight: §4.4 "자원 100 이상으로 15초 유휴" 강조 (0 또는 1) */
  update(snapshot: Snapshot, cashHighlight: number, deltaMs: number): void {
    const me = snapshot.players[snapshot.me];
    const foe = snapshot.players[snapshot.me === 0 ? 1 : 0];

    this.cash.text = String(me.cash);
    if (cashHighlight > 0) {
      this.highlightMs += deltaMs;
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(this.highlightMs * 0.005));
      this.cash.scale.set(1 + pulse * 0.12);
      this.cash.style.fill = pulse > 0.5 ? 0xffffff : COLOR.cash;
    } else {
      this.highlightMs = 0;
      this.cash.scale.set(1);
      this.cash.style.fill = COLOR.cash;
    }
    this.supply.text = `인구 ${me.supply}/${me.supplyMax}`;
    this.supply.style.fill = me.supply >= me.supplyMax ? COLOR.danger : COLOR.supply;
    this.age.text = `시대 ${me.age}`;

    const totalSec = Math.floor(snapshot.elapsedMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    this.timer.text = `${mm}:${ss}`;

    applyBar(this.myHpFill, me.baseHp, me.baseMaxHp);
    applyBar(this.foeHpFill, foe.baseHp, foe.baseMaxHp);
  }
}

function setupBar(bg: Sprite, fill: Sprite, x: number, y: number): void {
  bg.anchor.set(0, 0.5);
  bg.tint = 0x071120;
  bg.alpha = 0.9;
  bg.width = HP_W + 2;
  bg.height = HP_H + 2;
  bg.position.set(x - 1, y);

  // scale.x만 만지는 방식 (§2.4) — Graphics를 다시 만들지 않는다
  fill.anchor.set(0, 0.5);
  fill.height = HP_H;
  fill.position.set(x, y);
}

function applyBar(fill: Sprite, hp: number, maxHp: number): void {
  const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  fill.width = HP_W * ratio;
  fill.tint = ratio > 0.5 ? COLOR.ok : ratio > 0.25 ? 0xf0c040 : COLOR.danger;
}
