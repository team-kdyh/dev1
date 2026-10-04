import factionsSource from '../data/balance/factions.json';

/**
 * 진영 시각 정체성. 색은 **C의 `factions.json`에서 읽는다** — 코드에 적지 않는다.
 *
 * 세미콘(삼성 모티브): colorPrimary #1428A0 — 각지고 공업적인 실리콘 팹
 * 오차드(애플 모티브): colorPrimary #F5F5F7 — 둥글고 미니멀한 유리 캠퍼스
 *
 * 파생색(창문 불빛, 지면, 네온)은 원색에서 계산한다. 새 진영이 추가돼도 코드는 그대로다.
 */

interface FactionSource {
  readonly id: string;
  readonly name: string;
  readonly colorPrimary: string;
  readonly colorSecondary: string;
}

const hex = (value: string): number => Number.parseInt(value.replace('#', ''), 16);

const rgb = (color: number): [number, number, number] => [
  (color >> 16) & 0xff,
  (color >> 8) & 0xff,
  color & 0xff,
];

const pack = (r: number, g: number, b: number): number =>
  (Math.round(clamp01(r / 255) * 255) << 16) |
  (Math.round(clamp01(g / 255) * 255) << 8) |
  Math.round(clamp01(b / 255) * 255);

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** t<0 이면 검정 쪽으로, t>0 이면 흰색 쪽으로 */
export function shade(color: number, t: number): number {
  const [r, g, b] = rgb(color);
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  return pack(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
}

export function mix(a: number, b: number, t: number): number {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return pack(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export interface FactionTheme {
  readonly id: string;
  readonly name: string;
  /** 진영 원색 */
  readonly primary: number;
  readonly secondary: number;
  /** 원경 건물 몸체 */
  readonly far: number;
  /** 중경 건물 몸체 */
  readonly mid: number;
  /** 창문·LED 불빛 */
  readonly light: number;
  /** 지면 */
  readonly ground: number;
  /** 지면 경계선 */
  readonly groundEdge: number;
  /** 지평선 발광 */
  readonly glow: number;
  /** 각진 실루엣인가(삼성) 둥근 실루엣인가(애플) */
  readonly angular: boolean;
}

function build(source: FactionSource): FactionTheme {
  const primary = hex(source.colorPrimary);
  const secondary = hex(source.colorSecondary);

  // 원색이 밝으면(애플의 #F5F5F7) 배경은 어둡게 깔고 원색을 빛으로 쓴다.
  // 원색이 어두우면(삼성의 #1428A0) 원색 자체를 건물 색으로 쓸 수 있다.
  const [r, g, b] = rgb(primary);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const bright = luminance > 0.5;

  return {
    id: source.id,
    name: source.name,
    primary,
    secondary,
    far: bright ? shade(secondary, -0.68) : shade(primary, -0.62),
    mid: bright ? shade(secondary, -0.52) : shade(primary, -0.42),
    light: bright ? primary : mix(primary, 0xffffff, 0.55),
    ground: bright ? shade(secondary, -0.58) : shade(primary, -0.72),
    groundEdge: bright ? shade(secondary, -0.2) : mix(primary, 0xffffff, 0.35),
    glow: bright ? mix(primary, 0x6fa8ff, 0.25) : mix(primary, 0x63b4ff, 0.5),
    // 밝고 미니멀한 진영은 둥글게, 어둡고 공업적인 진영은 각지게
    angular: !bright,
  };
}

const THEMES: Record<string, FactionTheme> = Object.fromEntries(
  (factionsSource.factions as FactionSource[]).map((f) => [f.id, build(f)]),
);

const FALLBACK = build({
  id: 'unknown',
  name: '미지정',
  colorPrimary: '#5a6b86',
  colorSecondary: '#8fa2c4',
});

export function factionTheme(id: string): FactionTheme {
  return THEMES[id] ?? FALLBACK;
}

/** 왼쪽 본진 진영 → 오른쪽 본진 진영 순서. 배경이 좌우를 나눠 그릴 때 쓴다. */
export const FACTION_ORDER: readonly string[] = (factionsSource.factions as FactionSource[]).map(
  (f) => f.id,
);
