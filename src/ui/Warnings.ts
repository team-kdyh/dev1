import { Container, Graphics } from 'pixi.js';
import type { Snapshot } from '../sim/contracts';

/** 본진 HP 25% 이하 (§4.4) */
const HP_WARN_RATIO = 0.25;
/** 자원 100 이상으로 15초 유휴 (§4.4) */
const IDLE_CASH = 100;
const IDLE_MS = 15000;

/**
 * 경고 연출. (명세 §4.4)
 * - 본진 HP 25% 이하: 적색 비네트 펄스 + 1회 경고음
 * - 자원 100 이상으로 15초 유휴: 캐시 아이콘 강조
 *
 * 경고음은 사운드가 들어오는 M2까지 재생 지점만 잡아둔다.
 */
export class Warnings {
  readonly root = new Container();

  private readonly vignette = new Graphics();
  private pulseMs = 0;
  private alarmPlayed = false;

  private idleMs = 0;
  private lastCash = 0;
  /** 캐시 유휴 강조 강도 0~1 — ResourceBar가 읽어간다 */
  cashHighlight = 0;

  constructor() {
    this.vignette.alpha = 0;
    this.root.addChild(this.vignette);
    this.root.eventMode = 'none';
  }

  resize(width: number, height: number): void {
    this.vignette.clear();
    // 테두리로 갈수록 짙어지는 사각 비네트를 겹쳐 그린다
    const bands = 7;
    for (let i = 0; i < bands; i += 1) {
      const inset = i * Math.min(width, height) * 0.035;
      this.vignette
        .rect(inset, inset, width - inset * 2, height - inset * 2)
        .stroke({ width: Math.min(width, height) * 0.035, color: 0xd0201a, alpha: 0.1 });
    }
  }

  update(snapshot: Snapshot, deltaMs: number): void {
    const me = snapshot.players[snapshot.me];

    // 본진 HP 경고
    const ratio = me.baseMaxHp > 0 ? me.baseHp / me.baseMaxHp : 1;
    if (ratio <= HP_WARN_RATIO && snapshot.phase === 'playing') {
      this.pulseMs += deltaMs;
      this.vignette.alpha = 0.35 + 0.35 * Math.abs(Math.sin(this.pulseMs * 0.004));
      if (!this.alarmPlayed) {
        this.alarmPlayed = true;
        // TODO(M2 사운드): 경고음 1회 재생
      }
    } else {
      this.vignette.alpha = 0;
      this.pulseMs = 0;
      this.alarmPlayed = false;
    }

    // 자원 유휴 경고 — 캐시가 줄지 않은 채 쌓이기만 하면 유휴로 본다
    if (me.cash >= IDLE_CASH && me.cash >= this.lastCash) {
      this.idleMs += deltaMs;
    } else {
      this.idleMs = 0;
    }
    this.lastCash = me.cash;
    this.cashHighlight = this.idleMs >= IDLE_MS ? 1 : 0;
  }
}
