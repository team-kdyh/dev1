/**
 * §7 화면 흐름용 DOM 레이어 유틸.
 *
 * 인게임 HUD는 Pixi지만(카메라 셰이크·슬로우와 같이 움직여야 하므로),
 * 메뉴·도감·결과는 스크롤과 필터가 필요해 DOM으로 얹는다. index.html의 #ui-root가 그 자리다.
 */

let styleInjected = false;

const CSS = `
.sw-screen {
  position: absolute; inset: 0; pointer-events: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(8, 11, 22, 0.92); color: #e6eeff;
  font-family: "Malgun Gothic", system-ui, sans-serif;
}
.sw-screen.sw-transparent { background: rgba(8, 11, 22, 0.72); }
.sw-title { font-size: 44px; font-weight: 800; letter-spacing: 2px; margin: 0 0 6px; }
.sw-sub { color: #8fa2c4; margin: 0 0 28px; font-size: 14px; }
.sw-menu { display: flex; flex-direction: column; gap: 10px; width: 260px; }
.sw-btn {
  appearance: none; border: 1px solid #2c3852; background: #141c2f; color: #e6eeff;
  padding: 12px 16px; border-radius: 8px; font-size: 15px; cursor: pointer;
  font-family: inherit; min-height: 44px; transition: background .12s, transform .08s;
}
.sw-btn:hover { background: #1d2740; }
.sw-btn:active { transform: scale(.98); }
.sw-btn:disabled { opacity: .45; cursor: default; }
.sw-panel {
  width: min(960px, 92vw); max-height: 84vh; display: flex; flex-direction: column;
  background: #0f1525; border: 1px solid #2c3852; border-radius: 12px; overflow: hidden;
}
.sw-panel-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 14px 18px; border-bottom: 1px solid #2c3852;
}
.sw-panel-head h2 { margin: 0; font-size: 18px; flex: 1; }
.sw-filter {
  appearance: none; border: 1px solid #2c3852; background: #141c2f; color: #e6eeff;
  border-radius: 6px; padding: 6px 10px; font-size: 13px; cursor: pointer; font-family: inherit;
}
.sw-filter[data-on="1"] { background: #26406b; border-color: #4a9eff; }
.sw-panel-body { overflow: auto; padding: 16px 18px; }
.sw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
.sw-card { border: 1px solid #2c3852; border-radius: 10px; padding: 12px; background: #131b2d; }
.sw-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.sw-chip { font-size: 11px; padding: 2px 7px; border-radius: 999px; background: #26406b; color: #bcd6ff; }
.sw-card-name { font-weight: 700; font-size: 14px; }
.sw-preview {
  width: 100%; height: 116px; display: block; position: relative; overflow: hidden;
  background: radial-gradient(circle at 50% 82%, #263652 0, #10192b 38%, #0b1020 72%);
  border-radius: 8px; border-bottom: 2px solid #2a3852;
}
.sw-preview-figure {
  position: absolute; left: 50%; bottom: 1px; transform-origin: center bottom;
  animation: sw-character-idle 1.8s ease-in-out infinite;
}
.sw-preview-sprite { position: absolute; background-repeat: no-repeat; image-rendering: auto; }
.sw-preview-missing { position: absolute; inset: 0; display: grid; place-items: center; color: #8fa2c4; font-size: 12px; }
@keyframes sw-character-idle {
  0%, 100% { margin-bottom: 0; }
  50% { margin-bottom: 3px; }
}
.sw-unit-desc { min-height: 34px; color: #b9c7df; font-size: 12px; line-height: 1.4; margin: 9px 0 0; }
.sw-stats { list-style: none; margin: 10px 0 0; padding: 0; font-size: 12px; }
.sw-stats li { display: flex; justify-content: space-between; padding: 2px 0; color: #8fa2c4; }
.sw-stats li b { color: #e6eeff; font-weight: 600; font-family: Consolas, monospace; }
.sw-unit-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 9px; min-height: 20px; }
.sw-role { padding: 2px 6px; border-radius: 999px; background: #22324e; color: #bdd5fa; font-size: 10px; }
.sw-skill-list { display: flex; flex-direction: column; gap: 2px; margin-top: 7px; color: #8fa2c4; font-size: 11px; }
.sw-skill-list b { color: #e6eeff; font-size: 11px; }
.sw-result-rows { list-style: none; padding: 0; margin: 0 0 24px; width: 300px; font-size: 14px; }
.sw-result-rows li { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #1d2740; }
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
    style.textContent = CSS;
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
