/** HUD 공통 상수. D의 UI 에셋이 오면 색/폰트만 여기서 바꾼다. */

export const UI_FONT = ['Malgun Gothic', 'system-ui', 'sans-serif'];
export const UI_MONO = ['Consolas', 'monospace'];

export const COLOR = {
  panel: 0x121828,
  panelEdge: 0x2c3852,
  text: 0xe6eeff,
  textDim: 0x8fa2c4,
  cash: 0xffd34d,
  supply: 0x6ec8ff,
  danger: 0xe6483c,
  ok: 0x5ddc7a,
  ready: 0x7fe0a0,
} as const;

/** 유닛 버튼 (§4.1). 모바일 터치 44px 이상 요구(M2)를 미리 만족시켜 둔다. */
export const BUTTON_W = 82;
export const BUTTON_H = 90;
export const BUTTON_GAP = 6;
export const BAR_MARGIN = 14;
