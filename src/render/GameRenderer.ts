import { Container } from 'pixi.js';
import type { BalanceData, SimEvent, Snapshot, UnitSnapshot } from '../sim/contracts';
import { LOGICAL_MAX, type SimAdapter } from '../adapter/SimAdapter';
import { FACTION_OF_PLAYER } from '../data/gameData';
import { BaseView } from './BaseView';
import type { Camera } from './Camera';
import { toPixel } from './coords';
import { EffectDirector } from './EffectDirector';
import type { Interpolator } from './Interpolator';
import { DamageTextPool, ObjectPool, ParticlePool } from './pools';
import { ProjectileLayer } from './ProjectileLayer';
import { buildFarLayer, buildGroundLayer, buildMidLayer, buildSky, drawSky } from './scenery';
import { UnitView } from './UnitView';

/** 컬링 여유폭 — 화면 경계에서 유닛이 깜박이며 사라지는 걸 막는다 (§2.4) */
const CULL_PAD = 140;

/**
 * 명세 §2.3 레이어 스택을 세우고 스냅샷을 화면으로 바꾸는 곳.
 *
 * §0-1을 지킨다 — 스냅샷은 읽기만 하고, 게임 상태를 만들어내지 않는다.
 * 프론트가 소유하는 건 "뷰의 수명"과 "Y좌표"뿐이다.
 */
export class GameRenderer {
  /** 카메라가 움직이는 대상 */
  readonly world = new Container();
  /** 카메라를 따라가지 않는 연출용 화면 고정 레이어 */
  readonly screenLayer = new Container();

  private readonly sky = buildSky(1, 1);
  private readonly far = buildFarLayer();
  private readonly mid = buildMidLayer();
  private readonly ground = buildGroundLayer();
  private readonly baseLayer = new Container();
  private readonly unitLayer = new Container();
  private readonly projectileContainer = new Container();
  private readonly effectLayer = new Container();
  private readonly overlayLayer = new Container();

  readonly bases: readonly [BaseView, BaseView];
  readonly effects: EffectDirector;

  private readonly projectiles: ProjectileLayer;
  private readonly damageText: DamageTextPool;
  private readonly particles: ParticlePool;

  private readonly pool = new ObjectPool<UnitView>(() => new UnitView());
  private readonly views = new Map<number, UnitView>();
  private readonly dying: UnitView[] = [];
  /** 매 프레임 재사용하는 조회용 버퍼 — 프레임마다 new 하지 않는다 */
  private readonly prevById = new Map<number, UnitSnapshot>();
  private readonly seen = new Set<number>();

  constructor(
    stage: Container,
    balance: BalanceData,
    adapter: SimAdapter,
    private readonly camera: Camera,
  ) {
    // 하늘은 카메라를 따라가지 않는다 — 화면 고정
    stage.addChild(this.sky, this.world, this.screenLayer);
    this.world.addChild(
      this.far, // 1 원경 (패럴랙스 0.2)
      this.mid, // 2 중경 (패럴랙스 0.5)
      this.ground, // 3 지면
      this.baseLayer, // 4 본진
      this.unitLayer, // 5 유닛
      this.projectileContainer, // 6 투사체
      this.effectLayer, // 7 이펙트/파티클
      this.overlayLayer, // 8 데미지 텍스트 / HP 바
    );

    // x 정렬은 zIndex에 맡긴다 — 앞쪽(오른쪽) 유닛이 위로 (§2.3)
    this.unitLayer.sortableChildren = true;

    this.bases = [
      new BaseView(FACTION_OF_PLAYER[0], toPixel(0)),
      new BaseView(FACTION_OF_PLAYER[1], toPixel(LOGICAL_MAX)),
    ];
    this.baseLayer.addChild(this.bases[0].root, this.bases[1].root);

    this.projectiles = new ProjectileLayer(this.projectileContainer);
    this.damageText = new DamageTextPool(this.overlayLayer);
    this.particles = new ParticlePool(this.effectLayer);

    this.effects = new EffectDirector(
      balance,
      adapter,
      camera,
      this.bases,
      this.damageText,
      this.particles,
      (unitId) => this.views.get(unitId),
      this.screenLayer,
    );
  }

  resize(width: number, height: number): void {
    drawSky(this.sky, width, height);
    this.effects.resize(width, height);
  }

  handleEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'attack') this.views.get(event.unitId)?.playAttack();
      if (event.type === 'skill') this.views.get(event.unitId)?.playAttack(true);
    }
    this.effects.handle(events);
  }

  draw(frame: Interpolator, deltaMs: number): void {
    const prev = frame.prev;
    const curr = frame.curr;
    const alpha = frame.alpha;

    // 패럴랙스: world가 이미 -centerX만큼 밀렸으므로 되돌릴 비율만큼 더해준다.
    // far.x = centerX * 0.8 → 실제 이동량은 centerX * 0.2 (§2.3)
    this.far.x = this.camera.centerX * 0.8;
    this.mid.x = this.camera.centerX * 0.5;

    this.prevById.clear();
    for (const unit of prev.units) this.prevById.set(unit.id, unit);

    this.seen.clear();
    for (const unit of curr.units) {
      this.seen.add(unit.id);
      let view = this.views.get(unit.id);
      if (!view) {
        view = this.pool.acquire();
        view.reset(unit, FACTION_OF_PLAYER[unit.owner]);
        this.unitLayer.addChild(view.root);
        this.overlayLayer.addChild(view.bar);
        this.views.set(unit.id, view);
      }
      view.apply(this.prevById.get(unit.id), unit, alpha);
      view.root.zIndex = view.worldX;
      view.tick(deltaMs);
      if (view.worldX < this.camera.viewLeft - CULL_PAD || view.worldX > this.camera.viewRight + CULL_PAD) {
        view.setVisible(false);
      } else {
        view.root.visible = true;
      }
    }

    // 스냅샷에서 사라짐 = 사망. kill 이벤트가 아니라 이 한 가지 경로로만 판정한다
    // (둘 다 쓰면 연출이 두 번 재생된다). 0.4초간 별도 목록에서 유지 (§2.2)
    for (const [id, view] of this.views) {
      if (this.seen.has(id)) continue;
      view.startDeath();
      this.views.delete(id);
      this.dying.push(view);
    }

    for (let i = this.dying.length - 1; i >= 0; i -= 1) {
      const view = this.dying[i];
      if (!view.tick(deltaMs)) continue;
      this.unitLayer.removeChild(view.root);
      this.overlayLayer.removeChild(view.bar);
      view.unitId = -1;
      this.dying.splice(i, 1);
      this.pool.release(view);
    }

    this.projectiles.draw(curr.projectiles);
    this.damageText.tick(deltaMs);
    this.particles.tick(deltaMs);
    this.effects.tick(deltaMs);

    for (let i = 0; i < 2; i += 1) {
      const player = curr.players[i];
      this.bases[i].setHp(player.baseHp, player.baseMaxHp);
      this.bases[i].tick(deltaMs);
    }
  }

  /** 카메라 자동 추적 목표: 최전방 아군과 적의 중간점 (§3) */
  frontlineX(snapshot: Snapshot): number {
    const me = snapshot.me;
    let allyFront = Number.NEGATIVE_INFINITY;
    let enemyFront = Number.POSITIVE_INFINITY;
    for (const unit of snapshot.units) {
      if (unit.owner === me) allyFront = Math.max(allyFront, unit.x);
      else enemyFront = Math.min(enemyFront, unit.x);
    }
    if (allyFront === Number.NEGATIVE_INFINITY) {
      return toPixel(me === 0 ? 0 : LOGICAL_MAX);
    }
    if (enemyFront === Number.POSITIVE_INFINITY) return toPixel(allyFront);
    return toPixel((allyFront + enemyFront) / 2);
  }

  /** 결과 화면(§7)의 "최대 전선" 집계에 쓴다 */
  viewOf(unitId: number): UnitView | undefined {
    return this.views.get(unitId);
  }

  destroy(): void {
    for (const view of this.views.values()) view.destroy();
    for (const view of this.dying) view.destroy();
    this.views.clear();
    this.dying.length = 0;
  }
}
