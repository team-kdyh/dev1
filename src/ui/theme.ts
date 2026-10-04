import { FACTION_ORDER, factionTheme, mix, shade } from '../render/factionTheme';

/**
 * HUD 공통 상수.
 *
 * 패널·강조색은 **진영 색(= C의 factions.json)에서 파생**된다 — 여기에 진영 색을 적지 않는다.
 * 왼쪽 진영(세미콘)은 각지고 짙은 파랑, 오른쪽 진영(오차드)은 밝은 은백이라
 * HUD는 두 색을 다 쓰되 "내 진영" 쪽을 강조색으로 삼는다.
 */

const LEFT = factionTheme(FACTION_ORDER[0] ?? 'semicon');
const RIGHT = factionTheme(FACTION_ORDER[1] ?? 'orchard');

export const UI_FONT = ['Malgun Gothic', 'system-ui', 'sans-serif'];
export const UI_MONO = ['Consolas', 'monospace'];

export const COLOR = {
  /** 패널 바탕 — 두 진영 색을 섞어 짙게 깐다 */
  panel: shade(mix(LEFT.primary, RIGHT.secondary, 0.35), -0.86),
  panelEdge: shade(mix(LEFT.primary, RIGHT.secondary, 0.5), -0.58),
  text: mix(RIGHT.primary, 0xffffff, 0.35),
  textDim: shade(mix(LEFT.primary, RIGHT.secondary, 0.6), -0.32),
  /** 캐시 — 진영과 무관한 자원색이라 그대로 둔다 */
  cash: 0xffd34d,
  supply: mix(LEFT.primary, 0xffffff, 0.55),
  danger: 0xe6483c,
  ok: 0x5ddc7a,
  ready: 0x7fe0a0,
  /** 왼쪽·오른쪽 진영 강조색 — 미니맵 점, 본진 HP 바 등이 쓴다 */
  left: LEFT.light,
  right: RIGHT.light,
} as const;

/** 진영 id → HUD 강조색 */
export function accentOf(faction: string): number {
  return factionTheme(faction).light;
}

/** 유닛 버튼 (§4.1). 모바일 터치 44px 이상 요구(M2)를 미리 만족시켜 둔다. */
export const BUTTON_W = 82;
export const BUTTON_H = 90;
export const BUTTON_GAP = 6;
export const BAR_MARGIN = 14;
