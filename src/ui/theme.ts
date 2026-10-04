/** HUD 공통 상수. D의 UI 에셋이 오면 색/폰트만 여기서 바꾼다. */

export const UI_FONT = ['Malgun Gothic', 'system-ui', 'sans-serif'];
export const UI_MONO = ['Consolas', 'monospace'];

export const COLOR = {
  panel: 0xfff7e6,
  panelEdge: 0x253044,
  text: 0x253044,
  textDim: 0x637183,
  cash: 0xb76811,
  supply: 0x1d6f9e,
  danger: 0xc83c43,
  ok: 0x2c9f6a,
  ready: 0x64bd83,
} as const;

/** 유닛 버튼 (§4.1). 모바일 터치 44px 이상 요구(M2)를 미리 만족시켜 둔다. */
export const BUTTON_W = 56;
export const BUTTON_H = 58;
export const BUTTON_GAP = 4;
export const BAR_MARGIN = 14;
