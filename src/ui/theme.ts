/** 전장 UI의 공통 토큰. 캐릭터 색을 살리는 어두운 아케이드 계기판. */

export const UI_FONT = ['Apple SD Gothic Neo', 'Malgun Gothic', 'system-ui', 'sans-serif'];
export const UI_MONO = ['Menlo', 'Consolas', 'monospace'];

export const COLOR = {
  panel: 0x172941,
  panelEdge: 0x628bb2,
  text: 0xf7f9ff,
  textDim: 0xadc4dc,
  cash: 0xffd16e,
  supply: 0x8bdbff,
  danger: 0xff7779,
  ok: 0x68d7a2,
  ready: 0x69caff,
} as const;

/** 유닛 버튼 (§4.1). 모바일 터치 44px 이상 요구(M2)를 미리 만족시켜 둔다. */
export const BUTTON_W = 64;
export const BUTTON_H = 72;
export const BUTTON_GAP = 5;
export const BAR_MARGIN = 14;
