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

  await initTextures(app.renderer);

  new App(app, GAME_BALANCE).start();
}

void boot();
