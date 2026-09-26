import { LOGICAL_MAX } from '../adapter/SimAdapter';

/** 논리 0~1000이 차지하는 월드 픽셀 폭 (명세 §2.1) */
export const WORLD_WIDTH = 4000;
export const GROUND_Y = 620;
export const SKY_HEIGHT = 720;

export const toPixel = (x: number): number => (x / LOGICAL_MAX) * WORLD_WIDTH;
export const toLogical = (px: number): number => (px / WORLD_WIDTH) * LOGICAL_MAX;

/**
 * 유닛의 Y는 시뮬에 없다. 겹침 방지용 오프셋을 프론트가 부여한다. (명세 §2.1)
 * id 기반 결정론적 지터 — 프레임마다 흔들리면 안 된다.
 */
export const laneY = (unitId: number): number => GROUND_Y + ((unitId * 37) % 5) * 6;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
