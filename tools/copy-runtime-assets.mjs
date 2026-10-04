import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'assets');
const destination = path.join(root, 'dist', 'assets');
const art = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
const audio = JSON.parse(await readFile(path.join(source, 'audio', 'manifest.json'), 'utf8'));
const required = new Set();

function add(relativePath) {
  const normalized = path.posix.normalize(relativePath);
  if (normalized.startsWith('../') || normalized.startsWith('/') || normalized === '..') {
    throw new Error(`Unsafe runtime asset path: ${relativePath}`);
  }
  required.add(normalized);
}

for (const atlasName of art.atlases) {
  add(`atlases/${atlasName}`);
  const atlas = JSON.parse(await readFile(path.join(source, 'atlases', atlasName), 'utf8'));
  add(`atlases/${atlas.meta.image}`);
}

// 메뉴와 도감은 각 캐릭터의 첫 idle 프레임을 직접 참조한다.
for (const [id, unit] of Object.entries(art.units)) {
  add(`frames/units/${unit.faction}/${id}_idle_00.png`);
}

for (const group of [audio.sfx, audio.bgm]) {
  for (const variants of Object.values(group)) {
    for (const sound of Object.values(variants)) {
      add(sound.ogg);
      add(sound.mp3);
    }
  }
}

let bytes = 0;
for (const relativePath of [...required].sort()) {
  const input = path.join(source, relativePath);
  const output = path.join(destination, relativePath);
  await mkdir(path.dirname(output), { recursive: true });
  await copyFile(input, output);
  bytes += (await stat(output)).size;
}
console.log(`Copied ${required.size} runtime assets (${(bytes / 1024 / 1024).toFixed(1)} MiB) to dist/assets`);
