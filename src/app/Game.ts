import type { Application } from 'pixi.js';
import type { BalanceData, PlayerId, SimEvent, UnitDef } from '../sim/contracts';
import type { SimAdapter } from '../adapter/SimAdapter';
import { CommandGate } from '../input/CommandGate';
import { InputRouter } from '../input/InputRouter';
import { Camera } from '../render/Camera';
import { GameRenderer } from '../render/GameRenderer';
import { Interpolator } from '../render/Interpolator';
import { toLogical, WORLD_WIDTH } from '../render/coords';
import { Hud } from '../ui/Hud';
import { GameAudio } from '../audio/GameAudio';
import { FACTION_OF_PLAYER } from '../data/gameData';
import type { MatchResult } from '../screens/Screens';
import { TutorialHint } from '../screens/TutorialHint';

/**
 * 인게임 한 판. 매 프레임 순서를 여기서 고정한다:
 *   스냅샷 샘플 → 이벤트 소비 → 카메라 → 그리기 → HUD
 *
 * 시뮬은 어댑터가 자기 rAF로 돌린다 (§1.2). 프론트는 tick 변화를 관찰해 보간한다 (§2.2).
 */
export class Game {
  private readonly renderer: GameRenderer;
  private readonly camera: Camera;
  private readonly input: InputRouter;
  private readonly hud: Hud;
  private readonly gate: CommandGate;
  private readonly interpolator: Interpolator;
  private readonly audio: GameAudio;
  private readonly tutorial: TutorialHint | null;

  /** onEvents는 step 중 동기로 불린다 — 여기 쌓아두고 프레임 경계에서 한 번에 소비한다. */
  private eventBuffer: SimEvent[] = [];

  private screenW = 0;
  private screenH = 0;
  private running = false;

  // §7 결과 화면 집계. 이벤트를 세는 것이지 전투 결과를 추측하는 게 아니다.
  private produced = 0;
  private killed = 0;
  private maxFrontline = 0;
  private finished: MatchResult | null = null;
  private resultTimer: number | null = null;

  constructor(
    private readonly app: Application,
    private readonly adapter: SimAdapter,
    balance: BalanceData,
    private readonly onGameOver: (result: MatchResult) => void,
    private readonly onQuit: () => void,
    tutorialFocus?: string,
  ) {
    const me = adapter.getSnapshot().me;
    this.tutorial = tutorialFocus ? new TutorialHint(tutorialFocus, me, balance) : null;
    this.tutorial?.mount();
    this.audio = new GameAudio(FACTION_OF_PLAYER[me]);
    this.camera = new Camera();
    this.camera.snapTo(me === 0 ? 0 : WORLD_WIDTH);
    this.camera.returnToAuto();
    this.renderer = new GameRenderer(app.stage, balance, adapter, this.camera);
    this.camera.attach(this.renderer.world);
    this.interpolator = new Interpolator(adapter.getSnapshot());
    this.gate = new CommandGate(adapter);

    this.hud = new Hud(app.stage, balance, me, this.camera, {
      send: (cmd) => { this.audio.click(); this.gate.send(cmd); },
      onPauseToggle: (paused) => this.adapter.setTimeScale?.(paused ? 0 : 1),
      onQuit: () => this.onQuit(),
      onLowHealth: () => this.audio.warning(),
    });

    this.input = new InputRouter(app.canvas, adapter, balance, this.camera, this.gate, {
      pickUnitAt: (x, y, radius) => this.pickUnitAt(x, y, radius),
      showUnitInfo: (x, y, def: UnitDef) => this.hud.showUnitInfo(x, y, this.screenW, this.screenH, def),
      hideUnitInfo: () => this.hud.hideUnitInfo(),
      toggleUpgrades: () => this.hud.toggleUpgrades(),
      togglePause: () => this.hud.togglePause(),
      isOverUi: (x, y) => this.hud.hitTest(x, y),
      isPaused: () => this.hud.isPaused,
    });

    this.adapter.onEvents((events) => {
      for (const event of events) this.eventBuffer.push(event);
      this.tally(events, me);
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.adapter.start();
    this.app.ticker.add(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.resultTimer !== null) {
      window.clearTimeout(this.resultTimer);
      this.resultTimer = null;
    }
    this.app.ticker.remove(this.tick);
    this.adapter.stop();
    this.audio.stop();
    this.tutorial?.hide();
    this.input.destroy();
    this.hud.root.destroy({ children: true });
    this.renderer.destroy();
    this.app.stage.removeChildren();
  }

  private readonly tick = (): void => {
    const deltaMs = Math.min(this.app.ticker.deltaMS, 100);

    if (this.screenW !== this.app.screen.width || this.screenH !== this.app.screen.height) {
      this.screenW = this.app.screen.width;
      this.screenH = this.app.screen.height;
      this.camera.resize(this.screenW, this.screenH);
      this.renderer.resize(this.screenW, this.screenH);
      this.hud.resize(this.screenW, this.screenH);
    }

    // 1) 스냅샷 샘플 — 프레임당 한 번만 읽어 아래로 내려준다 (§2.2)
    const snapshot = this.adapter.getSnapshot();
    this.interpolator.sample(snapshot, deltaMs);

    // 2) 이번 프레임에 쌓인 이벤트를 한 번에 연출로 (§6)
    if (this.eventBuffer.length > 0) {
      const batch = this.eventBuffer;
      this.eventBuffer = [];
      this.renderer.handleEvents(batch);
      this.hud.handleEvents(batch);
      this.tutorial?.handle(batch);
      this.audio.handle(batch, snapshot);
    }

    // 3) 카메라 (§3)
    if (snapshot.phase === 'playing') {
      this.camera.setAutoTarget(this.renderer.frontlineX(snapshot));
    }
    this.input.update(deltaMs);
    this.camera.update(deltaMs);

    // 4) 그리기
    this.renderer.draw(this.interpolator, deltaMs);
    this.hud.update(snapshot, deltaMs);

    // 5) 최대 전선 집계 (§7 결과 화면)
    for (const unit of snapshot.units) {
      if (unit.owner !== snapshot.me) continue;
      this.maxFrontline = Math.max(this.maxFrontline, unit.x);
    }

    if (this.finished) {
      const result = this.finished;
      this.finished = null;
      // §6: 슬로우모션이 끝난 뒤 결과 화면
      this.resultTimer = window.setTimeout(() => {
        this.resultTimer = null;
        if (this.running) this.onGameOver(result);
      }, 1700);
    }
  };

  private tally(events: readonly SimEvent[], me: PlayerId): void {
    for (const event of events) {
      if (event.type === 'spawn' && event.owner === me) this.produced += 1;
      else if (event.type === 'kill' && event.owner !== me) this.killed += 1;
      else if (event.type === 'gameOver') {
        this.finished = {
          outcome: event.winner === null ? 'draw' : event.winner === me ? 'win' : 'lose',
          elapsedMs: this.adapter.getSnapshot().elapsedMs,
          produced: this.produced,
          killed: this.killed,
          maxFrontline: this.maxFrontline,
          // RP는 밸런스/서버 데이터에 없다 — 지어내지 않는다
          rp: null,
        };
      }
    }
  }

  /**
   * 화면 x → 가장 가까운 유닛의 defId (§5 유닛 정보 팝업).
   * Y는 프론트가 부여한 레인 오프셋일 뿐이라 판정에 쓰지 않는다 (§2.1).
   */
  private pickUnitAt(screenX: number, _screenY: number, radiusPx: number): string | undefined {
    const snapshot = this.adapter.getSnapshot();
    const logicalX = toLogical(this.camera.screenToWorldX(screenX));
    const radiusLogical = toLogical(radiusPx / this.camera.scale);

    let best: string | undefined;
    let bestDist = Infinity;
    for (const unit of snapshot.units) {
      const dist = Math.abs(unit.x - logicalX);
      if (dist > radiusLogical || dist >= bestDist) continue;
      bestDist = dist;
      best = unit.defId;
    }
    return best;
  }
}
