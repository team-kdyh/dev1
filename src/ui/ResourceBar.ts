import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Snapshot } from '../sim/contracts';
import { COLOR, UI_FONT, UI_MONO } from './theme';

const PANEL_W = 236;
const PANEL_H = 86;
const HP_W = 190;
const HP_H = 8;

/** 캐시·인구·시대·본진 HP·타이머. (§4) */
export class ResourceBar {
  readonly root = new Container();

  private readonly panel = new Graphics();
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

  constructor() {
    this.panel.roundRect(0, 0, PANEL_W, PANEL_H, 10).fill({ color: COLOR.panel, alpha: 0.88 });
    this.panel.roundRect(0, 0, PANEL_W, PANEL_H, 10).stroke({ width: 2, color: COLOR.panelEdge, alignment: 1 });

    this.cash = new Text({
      text: '0',
      style: { fontFamily: UI_MONO, fontSize: 26, fontWeight: 'bold', fill: COLOR.cash },
    });
    this.cash.position.set(14, 8);

    this.supply = new Text({
      text: '0/0',
      style: { fontFamily: UI_MONO, fontSize: 14, fill: COLOR.supply },
    });
    this.supply.position.set(14, 42);

    this.age = new Text({
      text: '시대 1',
      style: { fontFamily: UI_FONT, fontSize: 13, fill: COLOR.text },
    });
    this.age.anchor.set(1, 0);
    this.age.position.set(PANEL_W - 14, 44);

    this.timer = new Text({
      text: '00:00',
      style: { fontFamily: UI_MONO, fontSize: 14, fill: COLOR.textDim },
    });
    this.timer.anchor.set(1, 0);
    this.timer.position.set(PANEL_W - 14, 14);

    setupBar(this.myHpBg, this.myHpFill, 14, 66);
    this.root.addChild(
      this.panel,
      this.cash,
      this.supply,
      this.age,
      this.timer,
      this.myHpBg,
      this.myHpFill,
    );

    this.foeLabel = new Text({
      text: '적 본진',
      style: { fontFamily: UI_FONT, fontSize: 12, fill: COLOR.textDim },
    });
    this.foeLabel.anchor.set(1, 0);
    this.foeLabel.position.set(HP_W, 0);
    setupBar(this.foeHpBg, this.foeHpFill, 0, 20);
    this.foeGroup.addChild(this.foeLabel, this.foeHpBg, this.foeHpFill);
    this.root.addChild(this.foeGroup);

    this.root.position.set(12, 12);
  }

  layout(screenW: number): void {
    this.foeGroup.position.set(screenW - HP_W - 24, 4);
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
    this.age.text = `시대 ${me.age + 1}`;

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
  bg.tint = 0x000000;
  bg.alpha = 0.6;
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
