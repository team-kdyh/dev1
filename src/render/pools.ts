import { Container, Sprite, Text, Texture } from 'pixi.js';

/**
 * 오브젝트 풀. 명세 §2.4: 투사체·파티클·데미지 텍스트는 **매 프레임 new 금지**.
 * 여기서 new가 일어나는 건 풀이 비었을 때 한 번뿐이고, 그 뒤로는 재사용된다.
 */

interface FloatingText {
  node: Text;
  lifeMs: number;
  totalMs: number;
  vy: number;
}

export class DamageTextPool {
  private readonly free: Text[] = [];
  private readonly active: FloatingText[] = [];

  constructor(
    private readonly layer: Container,
    private readonly cap = 64,
  ) {}

  spawn(x: number, y: number, amount: number, crit: boolean): void {
    if (this.active.length >= this.cap) this.recycle(0);

    const node = this.free.pop() ?? this.create();
    node.text = String(amount);
    node.style.fontSize = crit ? 26 : 17;
    node.style.fill = crit ? 0xffd34d : 0xffffff;
    node.scale.set(crit ? 1.15 : 1);
    node.position.set(x + (Math.random() - 0.5) * 14, y);
    node.alpha = 1;
    node.visible = true;
    this.layer.addChild(node);

    const totalMs = crit ? 900 : 700;
    this.active.push({ node, lifeMs: totalMs, totalMs, vy: crit ? -0.075 : -0.055 });
  }

  tick(deltaMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const item = this.active[i];
      item.lifeMs -= deltaMs;
      if (item.lifeMs <= 0) {
        this.recycle(i);
        continue;
      }
      item.node.y += item.vy * deltaMs;
      const t = item.lifeMs / item.totalMs;
      item.node.alpha = t > 0.6 ? 1 : t / 0.6;
    }
  }

  private recycle(index: number): void {
    const item = this.active.splice(index, 1)[0];
    item.node.visible = false;
    this.layer.removeChild(item.node);
    this.free.push(item.node);
  }

  private create(): Text {
    return new Text({
      text: '0',
      style: {
        fontFamily: 'monospace',
        fontSize: 17,
        fontWeight: 'bold',
        fill: 0xffffff,
        stroke: { color: 0x0a0d14, width: 4 },
      },
    });
  }
}

interface Particle {
  node: Sprite;
  vx: number;
  vy: number;
  lifeMs: number;
  totalMs: number;
}

export class ParticlePool {
  private readonly free: Sprite[] = [];
  private readonly active: Particle[] = [];

  constructor(
    private readonly layer: Container,
    private readonly cap = 300,
  ) {}

  /** kill 이벤트용 파편. D의 유닛별 고유 파괴 이펙트가 오면 교체된다. (§6) */
  burst(x: number, y: number, color: number, count = 10): void {
    for (let i = 0; i < count; i += 1) {
      if (this.active.length >= this.cap) this.recycle(0);
      const node = this.free.pop() ?? new Sprite(Texture.WHITE);
      const size = 2 + Math.random() * 4;
      node.width = size;
      node.height = size;
      node.tint = color;
      node.alpha = 1;
      node.visible = true;
      node.position.set(x, y - 14 - Math.random() * 20);
      this.layer.addChild(node);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.04 + Math.random() * 0.14;
      const totalMs = 380 + Math.random() * 320;
      this.active.push({
        node,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.09,
        lifeMs: totalMs,
        totalMs,
      });
    }
  }

  tick(deltaMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i -= 1) {
      const p = this.active[i];
      p.lifeMs -= deltaMs;
      if (p.lifeMs <= 0) {
        this.recycle(i);
        continue;
      }
      p.vy += 0.00045 * deltaMs; // 중력
      p.node.x += p.vx * deltaMs;
      p.node.y += p.vy * deltaMs;
      p.node.alpha = p.lifeMs / p.totalMs;
    }
  }

  private recycle(index: number): void {
    const p = this.active.splice(index, 1)[0];
    p.node.visible = false;
    this.layer.removeChild(p.node);
    this.free.push(p.node);
  }
}

/** UnitView처럼 생성 비용이 큰 객체를 위한 범용 풀 */
export class ObjectPool<T> {
  private readonly free: T[] = [];

  constructor(private readonly factory: () => T) {}

  acquire(): T {
    return this.free.pop() ?? this.factory();
  }

  release(item: T): void {
    this.free.push(item);
  }
}
