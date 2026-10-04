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

/* Broadcast arcade skin. The cards keep the unit art playful while the chrome stays legible. */
.sw-screen {
  --ink: #152238; --paper: #f7f5ed; --blue: #50a9f5; --coral: #ff7767;
  color: #f6f8ff;
  background:
    radial-gradient(ellipse at 15% 32%, rgba(31,124,218,.29), transparent 38%),
    radial-gradient(ellipse at 88% 70%, rgba(255,105,85,.18), transparent 38%),
    linear-gradient(143deg, #101a31, #162843 54%, #0d1428);
}
.sw-screen::before, .sw-screen::after { border: 1px solid rgba(177,218,255,.15); }
.sw-screen::before { width: 46vw; height: 46vw; left: -18vw; top: -27vw; }
.sw-screen::after { width: 37vw; height: 37vw; right: -10vw; bottom: -23vw; }
.sw-home { gap: 0; }
.sw-home::before {
  background: repeating-linear-gradient(0deg, transparent 0 39px, rgba(207,231,255,.09) 40px),
    repeating-linear-gradient(90deg, transparent 0 39px, rgba(207,231,255,.09) 40px);
  border: 0; border-radius: 0; width: 100%; height: 100%; min-width: 0; min-height: 0;
  top: 0; left: 0; mask-image: linear-gradient(90deg, transparent, #000 17%, #000 83%, transparent);
}
.sw-home::after { border: 0; background: radial-gradient(circle, rgba(71,162,255,.18), transparent 68%); }
.sw-eyebrow {
  padding: 7px 14px; border: 1px solid rgba(136,201,250,.48); border-radius: 5px;
  background: rgba(20,41,71,.88); color: #9ed8ff; box-shadow: none;
  font-size: 10px; letter-spacing: .22em;
}
.sw-title {
  margin: 17px 0 0; color: #fff; font-size: clamp(52px, 7.6vw, 100px);
  letter-spacing: -.075em; line-height: .91; -webkit-text-stroke: 0;
  text-shadow: 0 5px 0 #274c7d, 0 15px 35px rgba(0,0,0,.45);
}
.sw-home .sw-title::after {
  content: ''; display: block; width: 45%; height: 5px; margin: 13px auto 0;
  background: linear-gradient(90deg, #4eb3ff 0 47%, #f7f5ed 47% 53%, #ff7767 53%);
  border-radius: 3px;
}
.sw-sub { margin: 13px 0 18px; color: #c2d5e9; font-size: 14px; letter-spacing: .02em; }
.sw-home-stage {
  width: min(720px, 93vw); height: clamp(155px, 26vh, 225px); gap: 0;
  margin: 0 0 18px; border: 1px solid rgba(158,201,242,.28); border-radius: 22px;
  background: linear-gradient(105deg, rgba(57,117,183,.3), rgba(14,26,45,.66) 49%, rgba(173,70,76,.26));
  box-shadow: inset 0 1px 0 rgba(255,255,255,.15), 0 22px 55px rgba(0,0,0,.22);
  overflow: hidden;
}
.sw-home-stage::before {
  width: 100%; height: 25%; bottom: 0; transform: none; border: 0; border-radius: 0;
  background: linear-gradient(0deg, rgba(7,13,27,.64), transparent); z-index: 0;
}
.sw-fighter { width: 42%; height: 100%; isolation: isolate; }
.sw-fighter::before {
  width: min(70%, 205px); bottom: 14%; border: 1px solid rgba(255,255,255,.42);
  box-shadow: 0 0 0 12px rgba(255,255,255,.04), 0 0 0 27px rgba(255,255,255,.03);
  transform: scaleY(1); z-index: -1;
}
.sw-fighter-blue::before { background: radial-gradient(circle, #4eb5ff, #2764aa 72%); }
.sw-fighter-coral::before { background: radial-gradient(circle, #ffab84, #cc5062 72%); }
.sw-fighter img {
  position: absolute; bottom: 13px; width: auto; max-width: 75%; height: 85%;
  object-fit: contain; object-position: bottom; filter: drop-shadow(0 9px 7px rgba(5,14,31,.6));
  animation: sw-bob 1.8s ease-in-out infinite alternate;
}
.sw-fighter-blue img:not(.sw-fighter-support) { left: 35%; }
.sw-fighter-coral img:not(.sw-fighter-support) { right: 35%; transform: scaleX(-1); }
.sw-fighter .sw-fighter-support {
  height: 56%; max-width: 37%; bottom: 18px; opacity: .93;
  filter: drop-shadow(0 7px 5px rgba(5,14,31,.52));
}
.sw-fighter-blue .sw-fighter-support { left: 11%; }
.sw-fighter-coral .sw-fighter-support { right: 11%; transform: scaleX(-1); }
.sw-fighter-label {
  position: absolute; top: 16px; color: #e9f6ff; font: 900 11px/1 system-ui,sans-serif;
  letter-spacing: .18em; text-shadow: 0 2px 6px #071326;
}
.sw-fighter-blue .sw-fighter-label { left: 17px; }
.sw-fighter-coral .sw-fighter-label { right: 17px; }
.sw-versus {
  z-index: 2; width: 62px; height: 62px; border: 2px solid #f8e6b0;
  border-radius: 14px; background: #f6c966; color: #19243a;
  box-shadow: 0 8px 24px rgba(0,0,0,.3); font-size: 18px;
}
.sw-menu { width: min(720px, 93vw); gap: 9px; }
.sw-btn {
  min-height: 53px; border: 1px solid rgba(116,156,201,.45); border-radius: 10px;
  background: #263954; color: #f1f7ff; box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 5px 14px rgba(0,0,0,.16);
  font-size: 14px; letter-spacing: .02em;
}
.sw-btn:hover:not(:disabled) { background: #335274; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,.24); }
.sw-btn:active:not(:disabled) { transform: translateY(1px); box-shadow: inset 0 2px 6px rgba(0,0,0,.2); }
.sw-btn:disabled { box-shadow: none; opacity: .42; }
.sw-home .sw-menu .sw-btn:first-child { background: #3f9deb; border-color: #8bd6ff; color: #0a1c35; }
.sw-home .sw-menu .sw-btn:nth-child(2) { background: #ff8670; border-color: #ffb6a1; color: #321b2b; }
.sw-home .sw-menu .sw-btn:nth-child(-n+2) { display: flex; align-items: center; justify-content: space-between; padding-inline: 20px; }
.sw-home .sw-menu .sw-btn:nth-child(-n+2)::after { content: '→'; font-size: 21px; line-height: 1; }
.sw-home .sw-menu .sw-btn:first-child:hover:not(:disabled) { background: #77c7ff; }
.sw-home .sw-menu .sw-btn:nth-child(2):hover:not(:disabled) { background: #ffad96; }
.sw-home-footnote { margin: 17px 0 0; color: #849ebc; font: 800 10px/1.5 system-ui,sans-serif; letter-spacing: .2em; }
.sw-faction-card {
  border: 1px solid rgba(170,215,255,.35); border-radius: 18px;
  background: linear-gradient(145deg, #264d81, #182c4b); color: #fff;
  box-shadow: 0 14px 34px rgba(0,0,0,.27);
}
.sw-faction-card.sw-orchard { background: linear-gradient(145deg, #8d4854, #43253b); }
.sw-faction-card:hover { box-shadow: 0 19px 37px rgba(0,0,0,.32); }
.sw-faction-card { min-height: 305px; }
.sw-faction-card img { width: 195px; height: 205px; filter: drop-shadow(0 8px 7px rgba(0,0,0,.45)); }
.sw-faction-card small { color: #cddbeb; }
.sw-panel { border: 1px solid #d2ddec; border-radius: 18px; box-shadow: 0 24px 60px rgba(0,0,0,.32); }
.sw-panel-head { background: #203555; color: #f7f9ff; border-bottom: 0; padding: 16px 20px; }
.sw-panel-head .sw-btn { background: #eff5fc; color: #1c2a40; min-height: 38px; }
.sw-panel-body { color: #24344c; }
.sw-card { border: 1px solid #d9e2ed; border-radius: 12px; box-shadow: 0 5px 18px rgba(28,49,77,.09); }
.sw-stage-card { border-top: 5px solid #48a4eb; transition: transform .16s, box-shadow .16s; }
.sw-stage-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(28,49,77,.15); }
.sw-stage-orchard { border-top-color: #fb7b6d; }
.sw-stage-card .sw-btn { background: #294c77; color: #fff; }
.sw-stage-card .sw-btn:hover:not(:disabled) { background: #396fa7; }
.sw-filter { border: 1px solid #7fabc9; background: #eaf6ff; }
.sw-result-rows { border: 1px solid #d2deec; box-shadow: 0 20px 40px rgba(0,0,0,.18); color: #21344d; }
.sw-result-rows li { border-color: #dae3ec; }
.sw-verdict { -webkit-text-stroke: 0; text-shadow: 0 5px 0 rgba(0,0,0,.25); }
.sw-win { color: #8be3ae; } .sw-lose { color: #ff8f82; } .sw-draw { color: #ffd67e; }
.sw-screen.sw-transparent { background: rgba(7,15,30,.75); backdrop-filter: blur(8px); }
.sw-tutorial { border: 1px solid #81bdf1; background: #152844; color: #f3f8ff; box-shadow: 0 12px 30px rgba(0,0,0,.25); }
.sw-tutorial strong { color: #72c8ff; }
.sw-tutorial .sw-btn { min-height: 30px; }
@media (max-width: 620px) {
  .sw-home { justify-content: center; }
  .sw-home-stage { height: clamp(132px, 22vh, 175px); }
  .sw-home .sw-title { font-size: clamp(52px, 12vw, 73px); }
  .sw-home .sw-menu { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
  .sw-home .sw-menu .sw-btn { min-height: 49px; padding: 7px; font-size: 12px; }
  .sw-home .sw-menu .sw-btn:nth-child(-n+2) { padding-inline: 12px; }
  .sw-home-footnote { font-size: 9px; }
  .sw-versus { width: 45px; height: 45px; font-size: 13px; }
  .sw-fighter-label { font-size: 8px; }
  .sw-faction-card { min-height: 155px; }
  .sw-faction-card img { width: 105px; height: 110px; }
}
@media (prefers-reduced-motion: reduce) {
  .sw-fighter img { animation: none; }
  .sw-btn, .sw-faction-card, .sw-stage-card { transition: none; }
}
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
