import { Container, Text } from 'pixi.js';
import type { RejectReason } from '../sim/contracts';
import { COLOR, UI_FONT } from './theme';

const LIFE_MS = 1800;
const MAX_VISIBLE = 4;
const LINE_H = 24;

/** 거부 사유 문구. (§4.1 / §6 rejected) */
export const REJECT_TEXT: Record<RejectReason, string> = {
  NO_CASH: '캐시가 부족합니다',
  NO_SUPPLY: '인구가 가득 찼습니다',
  COOLDOWN: '아직 쿨다운 중입니다',
  LOCKED: '아직 해금되지 않았습니다',
  QUEUE_FULL: '생산 큐가 가득 찼습니다',
  GAME_OVER: '이미 끝난 게임입니다',
};

interface Toast {
  node: Text;
  lifeMs: number;
}

/** 사유 토스트. 텍스트 노드는 풀링해 재사용한다 (§2.4의 정신). */
export class ToastStack {
  readonly root = new Container();
  private readonly free: Text[] = [];
  private readonly active: Toast[] = [];
  private anchorX = 0;
  private anchorY = 0;

  layout(screenW: number, screenH: number, bottomMargin: number): void {
    this.anchorX = Math.round(screenW / 2);
    this.anchorY = Math.round(screenH - bottomMargin);
  }

  push(message: string): void {
    // 같은 메시지가 연달아 오면 수명만 늘린다 — 화면이 같은 줄로 도배되는 걸 막는다
    const existing = this.active.find((t) => t.node.text === message);
    if (existing) {
      existing.lifeMs = LIFE_MS;
      return;
    }
    if (this.active.length >= MAX_VISIBLE) this.recycle(0);

    const node = this.free.pop() ?? this.create();
    node.text = message;
    node.alpha = 1;
    node.visible = true;
    this.root.addChild(node);
    this.active.push({ node, lifeMs: LIFE_MS });
  }

  tick(deltaMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const toast = this.active[i];
      toast.lifeMs -= deltaMs;
      if (toast.lifeMs <= 0) this.recycle(i);
    }
    // 아래에서 위로 쌓는다
    for (let i = 0; i < this.active.length; i += 1) {
      const toast = this.active[i];
      const fromTop = this.active.length - 1 - i;
      toast.node.position.set(this.anchorX, this.anchorY - fromTop * LINE_H);
      const t = toast.lifeMs / LIFE_MS;
      toast.node.alpha = t > 0.35 ? 1 : t / 0.35;
    }
  }

  private recycle(index: number): void {
    const toast = this.active.splice(index, 1)[0];
    toast.node.visible = false;
    this.root.removeChild(toast.node);
    this.free.push(toast.node);
  }

  private create(): Text {
    const node = new Text({
      text: '',
      style: {
        fontFamily: UI_FONT,
        fontSize: 15,
        fontWeight: 'bold',
        fill: COLOR.danger,
        stroke: { color: 0x05070d, width: 4 },
      },
    });
    node.anchor.set(0.5, 1);
    return node;
  }
}
