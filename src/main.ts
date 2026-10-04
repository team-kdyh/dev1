import { Application } from 'pixi.js';
import { App } from './app/App';
import { GAME_BALANCE } from './data/gameData';
import { initTextures } from './render/textures';

async function boot(): Promise<void> {
  const app = new Application();
  await app.init({
    resizeTo: window,
    background: 0x0b0f1c,
    antialias: false,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    preference: 'webgl',
  });

  const host = document.getElementById('app');
  if (!host) throw new Error('#app 이 index.html에 없다');
  host.appendChild(app.canvas);

  await initTextures();

  new App(app, GAME_BALANCE).start();
}

void boot().catch((error: unknown) => {
  console.error('게임 시작 실패', error);
  const root = document.getElementById('ui-root') ?? document.body;
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText = 'position:fixed;inset:0;z-index:100;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;background:#bce8f4;color:#253044;font:700 18px system-ui;pointer-events:auto';
  const title = document.createElement('strong');
  title.textContent = '게임을 불러오지 못했습니다';
  const note = document.createElement('span');
  note.textContent = '연결 상태를 확인하고 다시 시도해 주세요.';
  const retry = document.createElement('button');
  retry.textContent = '다시 불러오기';
  retry.style.cssText = 'padding:12px 20px;border:3px solid #253044;border-radius:12px;background:#ffda70;color:#253044;font:900 16px system-ui;cursor:pointer';
  retry.addEventListener('click', () => window.location.reload());
  panel.append(title, note, retry);
  root.replaceChildren(panel);
});
