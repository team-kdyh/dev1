/** 메뉴와 도감은 스크롤과 필터가 필요하므로 캔버스 위 DOM 레이어를 쓴다. */
let styleInjected = false;

const CSS = `
.sw-screen {
  --ink: #253044; --paper: #fff9eb; --blue: #4d7fe4; --coral: #ff987e;
  position: absolute; inset: 0; z-index: 2; box-sizing: border-box; isolation: isolate;
  pointer-events: auto; overflow: auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px; color: var(--ink);
  background: radial-gradient(circle at 82% 18%, #fff4ba 0 9%, transparent 9.2%),
    linear-gradient(172deg, #bce8f4 0%, #e4f6ee 60%, #fce9ca 100%);
  font-family: "Arial Rounded MT Bold", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
}
.sw-screen::before, .sw-screen::after {
  content: ''; position: fixed; pointer-events: none; border: 4px solid rgba(37,48,68,.12);
  border-radius: 50%; z-index: -1;
}
.sw-screen::before { width: 34vw; height: 34vw; min-width: 220px; min-height: 220px; left: -13vw; top: -14vw; }
.sw-screen::after { width: 24vw; height: 24vw; min-width: 180px; min-height: 180px; right: -10vw; bottom: -12vw; }
.sw-screen.sw-transparent { background: rgba(37,48,68,.48); }
.sw-home { gap: 0; }
.sw-eyebrow {
  padding: 5px 13px; border: 2px solid var(--ink); border-radius: 999px;
  background: #fff9eb; box-shadow: 3px 3px 0 var(--ink);
  font-size: 11px; font-weight: 900; letter-spacing: .15em;
}
.sw-title {
  margin: 12px 0 2px; color: #fff9eb; text-align: center;
  font-size: clamp(44px, 7.2vw, 86px); font-weight: 1000; line-height: .95;
  letter-spacing: -.05em; -webkit-text-stroke: 3px var(--ink);
  paint-order: stroke fill;
  text-shadow: 4px 5px 0 #ffb947, 7px 8px 0 var(--ink);
}
.sw-sub { margin: 12px 0 18px; color: #41536c; font-size: 15px; font-weight: 800; text-align: center; }
.sw-home-stage {
  width: min(560px, 90vw); height: clamp(115px, 18vh, 175px); display: flex;
  align-items: end; justify-content: center; gap: clamp(8px, 3vw, 30px);
  margin-bottom: 12px; border-bottom: 6px solid var(--ink); position: relative;
}
.sw-home-stage::before {
  content: ''; position: absolute; bottom: -6px; width: 100%; height: 26px;
  background: #f4dcaa; border: 3px solid var(--ink); border-radius: 50% 50% 0 0;
  transform: translateY(22px); z-index: -1;
}
.sw-fighter { position: relative; display: grid; place-items: end center; width: 40%; height: 100%; }
.sw-fighter::before {
  content: ''; position: absolute; width: 83%; aspect-ratio: 1; bottom: 2px; border-radius: 50%;
  border: 3px solid var(--ink); transform: scaleY(.82); z-index: -1;
}
.sw-fighter-blue::before { background: #9dc2ff; }
.sw-fighter-coral::before { background: #ffc1aa; }
.sw-fighter img { width: min(90%, 150px); height: 100%; object-fit: contain; object-position: bottom; filter: drop-shadow(3px 4px 0 #253044); animation: sw-bob 1.7s ease-in-out infinite alternate; }
.sw-fighter-coral img { animation-delay: -.8s; transform: scaleX(-1); }
.sw-versus {
  flex: none; align-self: center; width: 58px; height: 58px; display: grid; place-items: center;
  background: #ffdc74; color: var(--ink); border: 4px solid var(--ink); border-radius: 50%;
  box-shadow: 4px 4px 0 var(--ink); font-size: 19px; font-weight: 1000; transform: rotate(-9deg);
}
@keyframes sw-bob { to { translate: 0 -7px; } }
.sw-menu { width: min(570px, 92vw); display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 11px; }
.sw-btn {
  appearance: none; min-height: 52px; border: 3px solid var(--ink); border-radius: 13px;
  padding: 10px 16px; background: var(--paper); color: var(--ink); cursor: pointer;
  box-shadow: 0 5px 0 var(--ink); font-family: inherit; font-size: 15px;
  font-weight: 900; line-height: 1.25;
  transition: transform .12s, box-shadow .12s, background .12s;
}
.sw-btn:hover:not(:disabled) { background: #fff0bb; transform: translateY(-2px); box-shadow: 0 7px 0 var(--ink); }
.sw-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 1px 0 var(--ink); }
.sw-btn:focus-visible, .sw-filter:focus-visible, .sw-faction-card:focus-visible { outline: 4px solid #fff; outline-offset: 2px; }
.sw-btn:disabled { opacity: .48; cursor: default; box-shadow: 0 3px 0 var(--ink); }
.sw-home .sw-menu .sw-btn:first-child { background: var(--blue); color: #fff; }
.sw-home .sw-menu .sw-btn:nth-child(2) { background: #ffda70; }
.sw-home .sw-menu .sw-btn:first-child:hover:not(:disabled) { background: #3868cb; }
.sw-home .sw-menu .sw-btn:last-child { grid-column: 1 / -1; }
.sw-faction-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); width: min(620px,92vw); gap: 14px; margin: 10px 0 20px; }
.sw-faction-card {
  appearance: none; display: flex; flex-direction: column; align-items: center; gap: 5px;
  min-height: 235px; padding: 15px; border: 4px solid var(--ink); border-radius: 18px;
  background: #e8f1ff; color: var(--ink); box-shadow: 5px 6px 0 var(--ink);
  cursor: pointer; font-family: inherit; transition: transform .12s, box-shadow .12s;
}
.sw-faction-card:hover { transform: translateY(-5px); box-shadow: 6px 10px 0 var(--ink); }
.sw-faction-card:active { transform: translateY(3px); box-shadow: 2px 3px 0 var(--ink); }
.sw-faction-card.sw-orchard { background: #fff0e9; }
.sw-faction-card img { width: 145px; height: 135px; object-fit: contain; filter: drop-shadow(3px 4px 0 #253044); }
.sw-faction-card strong { font-size: 21px; font-weight: 1000; }
.sw-faction-card small { font-size: 12px; font-weight: 800; color: #56657a; }
.sw-panel {
  width: min(1000px, 94vw); max-height: min(86vh, 900px); display: flex; flex-direction: column;
  background: var(--paper); border: 4px solid var(--ink); border-radius: 18px;
  box-shadow: 8px 9px 0 var(--ink); overflow: hidden;
}
.sw-panel-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 12px 16px; background: #ffdf83; border-bottom: 4px solid var(--ink); }
.sw-panel-head h2 { margin: 0 14px 0 0; font-size: 23px; font-weight: 1000; flex: 1; }
.sw-filter {
  appearance: none; border: 2px solid var(--ink); border-radius: 999px;
  padding: 7px 10px; background: #fff8e6; color: var(--ink); cursor: pointer;
  font-family: inherit; font-size: 12px; font-weight: 900;
}
.sw-filter[data-on="1"] { background: var(--blue); color: #fff; }
.sw-panel-body { overflow: auto; padding: 20px; }
.sw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(216px, 1fr)); gap: 16px; }
.sw-card { border: 3px solid var(--ink); border-radius: 14px; padding: 12px; background: #fffdf5; box-shadow: 3px 4px 0 #9cabba; }
.sw-stage-card { display: flex; flex-direction: column; min-height: 138px; box-sizing: border-box; border-top: 8px solid var(--blue); }
.sw-stage-orchard { border-top-color: var(--coral); }
.sw-stage-card .sw-missing { flex: 1; }
.sw-stage-card .sw-btn { align-self: flex-start; min-height: 40px; padding: 6px 13px; }
.sw-settings { width: min(560px, 94vw); }
.sw-settings-lead { margin: 0 0 18px; color: #56657a; font-weight: 800; }
.sw-setting-row { display: grid; grid-template-columns: 125px 1fr 52px; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 2px dashed #b9c6cf; }
.sw-setting-row strong { font-size: 15px; }
.sw-setting-row input { width: 100%; accent-color: var(--blue); cursor: pointer; }
.sw-setting-row output { text-align: right; font-weight: 900; }
.sw-settings-tip { margin: 22px 0 0; padding: 12px; border-radius: 9px; background: #e3f2f6; color: #4e5e71; font-size: 12px; line-height: 1.7; }
.sw-card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sw-chip { flex: none; font-size: 11px; font-weight: 900; padding: 4px 7px; border: 2px solid var(--ink); border-radius: 999px; background: #c9ddff; }
.sw-card-name { font-weight: 1000; font-size: 15px; }
.sw-preview { width: 100%; height: 112px; display: block; object-fit: contain; background: #def1f6; border: 2px solid var(--ink); border-radius: 9px; box-sizing: border-box; }
.sw-stats { list-style: none; margin: 10px 0 0; padding: 0; font-size: 12px; }
.sw-stats li { display: flex; justify-content: space-between; padding: 3px 0; color: #58677b; border-bottom: 1px dashed #c5ccd5; }
.sw-stats li b { color: var(--ink); font-weight: 900; }
.sw-missing { color: #58677b; font-size: 12px; line-height: 1.45; margin-top: 9px; }
.sw-result-rows { list-style: none; padding: 12px 18px; margin: 5px 0 23px; width: min(340px, 90vw); box-sizing: border-box; border: 3px solid var(--ink); border-radius: 14px; background: var(--paper); }
.sw-result-rows li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #b7c0ca; }
.sw-result-rows li:last-child { border: 0; }
.sw-verdict { font-size: clamp(50px, 8vw, 84px); font-weight: 1000; margin: 0 0 10px; -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill; text-shadow: 4px 5px 0 var(--ink); }
.sw-win { color: #80d591; }
.sw-lose { color: #ff8f81; }
.sw-draw { color: #ffda70; }
.sw-tutorial {
  position: absolute; z-index: 3; top: 14px; left: 50%; transform: translateX(-50%);
  width: min(480px, calc(100vw - 32px)); box-sizing: border-box;
  display: flex; align-items: center; gap: 10px; padding: 9px 11px;
  border: 3px solid #253044; border-radius: 12px; background: #fff9eb;
  box-shadow: 4px 5px 0 #253044; color: #253044; pointer-events: auto;
  font: 800 13px/1.45 "Malgun Gothic", system-ui, sans-serif;
}
.sw-tutorial strong { flex: none; color: #316dd3; }
.sw-tutorial span { flex: 1; }
.sw-tutorial .sw-btn { flex: none; min-height: 30px; padding: 4px 8px; font-size: 11px; }
@media (max-width: 620px) {
  .sw-screen { padding: 15px; justify-content: flex-start; }
  .sw-home { justify-content: center; }
  .sw-title { font-size: clamp(42px, 11vw, 62px); }
  .sw-home-stage { height: 125px; }
  .sw-menu { grid-template-columns: 1fr; gap: 7px; }
  .sw-btn { min-height: 45px; }
  .sw-faction-grid { grid-template-columns: 1fr; }
  .sw-faction-card { min-height: 155px; flex-direction: row; text-align: left; flex-wrap: wrap; justify-content: center; }
  .sw-faction-card img { width: 105px; height: 110px; }
  .sw-panel { max-height: 94vh; }
  .sw-panel-head { padding: 9px; }
  .sw-panel-body { padding: 12px; }
  .sw-tutorial { top: 84px; font-size: 11px; }
}
@media (prefers-reduced-motion: reduce) { .sw-fighter img { animation: none; } .sw-btn, .sw-faction-card { transition: none; } }
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
