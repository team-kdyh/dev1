import { Application } from 'pixi.js';
import { App } from './app/App';
import { PLACEHOLDER_BALANCE } from './data/placeholderBalance';
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

  // 플레이스홀더 텍스처는 renderer가 있어야 만들 수 있다 — init 이후에만 호출 가능
  initTextures(app.renderer);

  new App(app, PLACEHOLDER_BALANCE).start();
}

void boot();
