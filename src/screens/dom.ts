/**
 * §7 화면 흐름용 DOM 레이어 유틸.
 *
 * 인게임 HUD는 Pixi지만(카메라 셰이크·슬로우와 같이 움직여야 하므로),
 * 메뉴·도감·결과는 스크롤과 필터가 필요해 DOM으로 얹는다. index.html의 #ui-root가 그 자리다.
 */

import { FACTION_ORDER, factionTheme, mix, shade } from '../render/factionTheme';

let styleInjected = false;

/**
 * 진영 색을 CSS 변수로 내린다 — C의 factions.json이 바뀌면 화면도 같이 바뀐다.
 * 세미콘은 짙은 파랑(각진 느낌), 오차드는 은백(둥근 느낌)이라
 * 메뉴는 두 색을 좌우 그라디언트로 섞고 버튼은 세미콘 쪽을 강조색으로 쓴다.
 */
function themeVars(): string {
  const left = factionTheme(FACTION_ORDER[0] ?? 'semicon');
  const right = factionTheme(FACTION_ORDER[1] ?? 'orchard');
  const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  return `:root{
  --sw-left: ${css(left.primary)};
  --sw-left-light: ${css(left.light)};
  --sw-right: ${css(right.primary)};
  --sw-right-dim: ${css(right.secondary)};
  --sw-bg: ${css(shade(mix(left.primary, right.secondary, 0.35), -0.9))};
  --sw-panel: ${css(shade(mix(left.primary, right.secondary, 0.35), -0.84))};
  --sw-edge: ${css(shade(mix(left.primary, right.secondary, 0.5), -0.58))};
  --sw-text: ${css(mix(right.primary, 0xffffff, 0.3))};
  --sw-dim: ${css(shade(mix(left.primary, right.secondary, 0.6), -0.3))};
}`;
}

const CSS = `
.sw-screen {
  position: absolute; inset: 0; pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--sw-bg); color: var(--sw-text);
  font-family: "Malgun Gothic", system-ui, sans-serif;
}
.sw-screen.sw-transparent { background: color-mix(in srgb, var(--sw-bg) 82%, transparent); }
/* 두 진영 색이 왼쪽에서 오른쪽으로 넘어가는 타이틀 — 세미콘 → 오차드 */
.sw-title {
  font-size: 46px; font-weight: 800; letter-spacing: 3px; margin: 0 0 6px;
  background: linear-gradient(100deg, var(--sw-left-light) 0%, var(--sw-text) 46%, var(--sw-right) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.sw-sub { color: var(--sw-dim); margin: 0 0 28px; font-size: 14px; }
.sw-menu { display: flex; flex-direction: column; gap: 10px; width: 260px; }
.sw-btn {
  appearance: none; border: 1px solid var(--sw-edge); background: var(--sw-panel); color: var(--sw-text);
  padding: 12px 16px; border-radius: 8px; font-size: 15px; cursor: pointer;
  font-family: inherit; min-height: 44px; transition: background .12s, transform .08s;
}
.sw-btn:hover { background: color-mix(in srgb, var(--sw-left) 26%, var(--sw-panel)); border-color: var(--sw-left-light); }
.sw-btn:active { transform: scale(.98); }
.sw-btn:disabled { opacity: .45; cursor: default; }
.sw-panel {
  width: min(960px, 92vw); max-height: 84vh; display: flex; flex-direction: column;
  background: var(--sw-panel); border: 1px solid var(--sw-edge); border-radius: 12px; overflow: hidden;
}
.sw-panel-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 14px 18px; border-bottom: 1px solid var(--sw-edge);
}
.sw-panel-head h2 { margin: 0; font-size: 18px; flex: 1; }
.sw-filter {
  appearance: none; border: 1px solid var(--sw-edge); background: var(--sw-panel); color: var(--sw-text);
  border-radius: 6px; padding: 6px 10px; font-size: 13px; cursor: pointer; font-family: inherit;
}
.sw-filter[data-on="1"] { background: color-mix(in srgb, var(--sw-left) 55%, transparent); border-color: var(--sw-left-light); }
.sw-panel-body { overflow: auto; padding: 16px 18px; }
.sw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
.sw-card { border: 1px solid var(--sw-edge); border-radius: 10px; padding: 12px; background: color-mix(in srgb, var(--sw-panel) 82%, #000); }
.sw-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sw-chip { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: color-mix(in srgb, var(--sw-left) 60%, transparent); color: var(--sw-text); }
.sw-card-name { font-weight: 700; font-size: 14px; }
.sw-preview {
  width: 100%; height: 116px; display: block; position: relative; overflow: hidden;
  background: radial-gradient(circle at 50% 82%,
    color-mix(in srgb, var(--sw-left) 30%, var(--sw-panel)) 0,
    var(--sw-panel) 40%, var(--sw-bg) 74%);
  border-radius: 8px; border-bottom: 2px solid var(--sw-edge);
}
.sw-preview-figure {
  position: absolute; left: 50%; bottom: 1px; transform-origin: center bottom;
  animation: sw-character-idle 1.8s ease-in-out infinite;
}
.sw-preview-sprite { position: absolute; background-repeat: no-repeat; image-rendering: auto; }
.sw-preview-missing { position: absolute; inset: 0; display: grid; place-items: center; color: var(--sw-dim); font-size: 12px; }
@keyframes sw-character-idle {
  0%, 100% { margin-bottom: 0; }
  50% { margin-bottom: 3px; }
}
.sw-unit-desc { min-height: 34px; color: var(--sw-dim); font-size: 12px; line-height: 1.4; margin: 9px 0 0; }
.sw-stats { list-style: none; margin: 10px 0 0; padding: 0; font-size: 12px; }
.sw-stats li { display: flex; justify-content: space-between; padding: 2px 0; color: var(--sw-dim); }
.sw-stats li b { color: var(--sw-text); font-weight: 600; font-family: Consolas, monospace; }
.sw-unit-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; min-height: 20px; }
.sw-role { padding: 2px 6px; border-radius: 999px; background: color-mix(in srgb, var(--sw-left) 40%, transparent); color: var(--sw-text); font-size: 10px; }
.sw-skill-list { display: flex; flex-direction: column; gap: 2px; margin-top: 7px; color: var(--sw-dim); font-size: 11px; }
.sw-skill-list b { color: var(--sw-text); font-size: 11px; }
.sw-result-rows { list-style: none; padding: 0; margin: 0 0 24px; width: 300px; font-size: 14px; }
.sw-result-rows li { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--sw-edge); }
.sw-result-rows li b { font-family: Consolas, monospace; }
.sw-verdict { font-size: 52px; font-weight: 800; margin: 0 0 18px; }
.sw-win { color: #5ddc7a; }
.sw-lose { color: #e6483c; }
`;

export function uiRoot(): HTMLElement {
  const root = document.getElementById('ui-root');
  if (!root) throw new Error('#ui-root 이 index.html에 없다');
  if (!styleInjected) {
    const style = document.createElement('style');
    style.textContent = `${themeVars()}\n${CSS}`;
    document.head.appendChild(style);
    styleInjected = true;
  }
  return root;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text: string, onClick: () => void): HTMLButtonElement {
  const node = el('button', 'sw-btn', text);
  node.addEventListener('click', onClick);
  return node;
}
