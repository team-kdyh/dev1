import type { BalanceData, Command, UnitDef } from '../sim/contracts';
import type { SimAdapter } from '../adapter/SimAdapter';
import type { Camera } from '../render/Camera';
import { FACTION_OF_PLAYER, findUnitDef, unitsOfFaction } from '../data/gameData';
import type { CommandGate } from './CommandGate';

/** 키보드 팬 속도 (월드 px / ms) */
const KEY_PAN_SPEED = 1.5;
/** 길게 누르기 판정 (§5) */
const LONG_PRESS_MS = 400;
/** 유닛 정보 팝업의 히트 반경 (월드 px) */
const PICK_RADIUS = 34;

export interface InputHost {
  /** 화면 좌표에서 가장 가까운 유닛의 정의를 찾는다. 없으면 undefined. */
  pickUnitAt(screenX: number, screenY: number, radius: number): string | undefined;
  showUnitInfo(screenX: number, screenY: number, def: UnitDef): void;
  hideUnitInfo(): void;
  toggleUpgrades(): void;
  togglePause(): void;
  isOverUi(screenX: number, screenY: number): boolean;
  isPaused(): boolean;
}

/**
 * 입력 → 커맨드. (명세 §5)
 *
 * 절대 원칙: 프론트는 낙관적으로 상태를 바꾸지 않는다.
 * 여기서 하는 일은 gate.send() 호출과 카메라·UI 토글뿐이다.
 */
export class InputRouter {
  private panDirection = 0;
  private dragging = false;
  private panning = false;
  private lastPointerX = 0;
  private pressStartMs = 0;
  private pressX = 0;
  private pressY = 0;
  private longPressFired = false;

  private readonly onKeyDown = (e: KeyboardEvent) => this.handleKeyDown(e);
  private readonly onKeyUp = (e: KeyboardEvent) => this.handleKeyUp(e);
  private readonly onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (this.host.isPaused() || this.adapter.getSnapshot().phase !== 'playing') return;
    this.showInfoAt(e.clientX, e.clientY);
  };
  private readonly onPointerDown = (e: PointerEvent) => {
    if (this.host.isPaused() || this.adapter.getSnapshot().phase !== 'playing') return;
    // HUD가 입력을 먼저 가져간다 — 버튼을 누르다 카메라가 끌려가면 안 된다
    if (this.host.isOverUi(e.clientX, e.clientY)) return;
    if (e.button === 2) return; // 우클릭은 contextmenu에서 처리
    this.dragging = true;
    this.panning = false;
    this.lastPointerX = e.clientX;
    this.pressStartMs = performance.now();
    this.pressX = e.clientX;
    this.pressY = e.clientY;
    this.longPressFired = false;
  };
  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastPointerX;
    this.lastPointerX = e.clientX;
    // 길게 누르기 중에 손가락이 움직이면 드래그로 본다
    if (Math.abs(e.clientX - this.pressX) > 8 || Math.abs(e.clientY - this.pressY) > 8) {
      this.pressStartMs = 0;
      this.panning = true;
    }
    if (!this.panning || dx === 0) return;
    this.camera.panBy(-dx / this.camera.scale);
  };
  private readonly onPointerUp = () => {
    this.dragging = false;
    this.panning = false;
    this.pressStartMs = 0;
    if (this.longPressFired) this.host.hideUnitInfo();
    this.longPressFired = false;
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly adapter: SimAdapter,
    private readonly balance: BalanceData,
    private readonly camera: Camera,
    private readonly gate: CommandGate,
    private readonly host: InputHost,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  update(deltaMs: number): void {
    if (this.host.isPaused() || this.adapter.getSnapshot().phase !== 'playing') {
      this.panDirection = 0;
      return;
    }
    if (this.panDirection !== 0) {
      this.camera.panBy(this.panDirection * KEY_PAN_SPEED * deltaMs);
    }
    // 길게 누르기 → 유닛 정보 팝업 (§5)
    if (this.pressStartMs > 0 && !this.longPressFired) {
      if (performance.now() - this.pressStartMs >= LONG_PRESS_MS) {
        this.longPressFired = true;
        this.showInfoAt(this.pressX, this.pressY);
      }
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
  }

  private showInfoAt(screenX: number, screenY: number): void {
    const defId = this.host.pickUnitAt(screenX, screenY, PICK_RADIUS);
    if (!defId) {
      this.host.hideUnitInfo();
      return;
    }
    const def = findUnitDef(this.balance, defId);
    if (def) this.host.showUnitInfo(screenX, screenY, def);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      this.host.togglePause();
      return;
    }
    if (this.host.isPaused() || this.adapter.getSnapshot().phase !== 'playing') return;

    // 숫자키 1~9 → 해당 티어 유닛 (§5)
    if (e.code.startsWith('Digit')) {
      const tier = Number(e.code.slice(5));
      if (tier >= 1 && tier <= 9) {
        const def = this.myUnits()[tier - 1];
        if (def) this.send({ type: 'SPAWN_UNIT', defId: def.id });
      }
      return;
    }

    switch (e.code) {
      case 'KeyQ':
        this.send({ type: 'USE_STRATEGY', slot: 0 });
        break;
      case 'KeyW':
        this.send({ type: 'USE_STRATEGY', slot: 1 });
        break;
      case 'KeyE':
        this.send({ type: 'AGE_UP' });
        break;
      case 'KeyR':
        this.host.toggleUpgrades();
        break;
      case 'Space':
        e.preventDefault();
        this.camera.returnToAuto();
        break;
      case 'ArrowLeft':
        this.panDirection = -1;
        break;
      case 'ArrowRight':
        this.panDirection = 1;
        break;
      default:
        break;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'ArrowLeft' && this.panDirection === -1) this.panDirection = 0;
    if (e.code === 'ArrowRight' && this.panDirection === 1) this.panDirection = 0;
  }

  /** 내 진영 유닛을 티어 순으로. 비용·이름은 여기서 읽지 않는다 — UnitBar(§4.1)의 몫. */
  private myUnits(): UnitDef[] {
    const me = this.adapter.getSnapshot().me;
    return unitsOfFaction(this.balance, FACTION_OF_PLAYER[me]);
  }

  private send(cmd: Command): void {
    this.gate.send(cmd);
  }
}
