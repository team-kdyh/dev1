import audioManifestSource from '../../assets/audio/manifest.json';
import { resolveAssetUnitId } from '../data/assetMap';
import type { PlayerId, SimEvent } from '../sim/contracts';

interface AudioEntry {
  ogg: string;
  mp3: string;
}

interface AudioManifest {
  sfx: Record<string, Record<string, AudioEntry>>;
  bgm: Record<string, Record<string, AudioEntry>>;
}

const manifest = audioManifestSource as unknown as AudioManifest;
const audioUrls = import.meta.glob('../../assets/audio/**/*.{ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
let preferOgg: boolean | undefined;

const BGM_VOLUME: Readonly<Record<string, number>> = {
  bass_drums: 0.2,
  synth: 0.13,
  strings: 0.1,
  age4: 0.28,
};

/** D의 OGG 파일을 시뮬레이션 이벤트와 연결하는 가벼운 전투 오디오 믹서. */
export class AudioDirector {
  private readonly voices = new Map<string, HTMLAudioElement[]>();
  private readonly bgm = new Map<string, HTMLAudioElement>();
  private started = false;
  private age = 0;

  constructor(private readonly faction: 'semicon' | 'orchard') {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.syncBgm();
  }

  stop(): void {
    this.started = false;
    for (const track of this.bgm.values()) {
      track.pause();
      track.currentTime = 0;
    }
    this.bgm.clear();
    for (const pool of this.voices.values()) {
      for (const voice of pool) voice.pause();
    }
  }

  handle(events: readonly SimEvent[], me: PlayerId): void {
    for (const event of events) {
      switch (event.type) {
        case 'attack':
          if (!event.skill) this.playUnit(event.defId, 'attack', event.ranged ? 0.25 : 0.34);
          break;
        case 'skill':
          this.playUnit(event.defId, 'skill', 0.42);
          break;
        case 'kill':
          this.playUnit(event.defId, 'death', 0.34);
          break;
        case 'baseHit':
          this.playMisc('base_hit', 0.42);
          break;
        case 'ageup':
          this.playMisc('age_up', 0.46);
          if (event.owner === me) {
            this.age = event.age;
            this.syncBgm();
          }
          break;
        case 'spawn':
          if (event.defId.includes('_t9_')) {
            this.playMisc(event.owner === 0 ? 't9_semicon_cutin' : 't9_orchard_cutin', 0.5);
          }
          break;
        case 'rejected':
          this.playMisc('purchase_fail', 0.32);
          break;
        case 'gameOver':
          this.playMisc(event.winner === me ? 'victory' : 'defeat', 0.52);
          break;
        case 'strategy':
          this.playMisc(event.owner === 0 ? 'semicon_fast_charge' : 'orchard_airdrop', 0.4);
          break;
        case 'hit':
          // 타격감은 공격 SFX와 방어 시각 연출이 담당한다. 별도 hit 파일은 D 매니페스트에 없다.
          break;
      }
    }
  }

  private syncBgm(): void {
    if (!this.started) return;
    const wanted = this.age >= 3
      ? ['age4']
      : ['bass_drums', ...(this.age >= 1 ? ['synth'] : []), ...(this.age >= 2 ? ['strings'] : [])];

    const referenceTime = [...this.bgm.values()][0]?.currentTime ?? 0;
    for (const [layer, track] of this.bgm) {
      if (wanted.includes(layer)) continue;
      track.pause();
      this.bgm.delete(layer);
    }
    for (const layer of wanted) {
      if (this.bgm.has(layer)) continue;
      const entry = manifest.bgm[this.faction]?.[layer];
      const url = entry ? urlFor(entry) : undefined;
      if (!url) continue;
      const track = new Audio(url);
      track.loop = true;
      track.preload = 'auto';
      track.volume = BGM_VOLUME[layer] ?? 0.15;
      track.currentTime = referenceTime;
      this.bgm.set(layer, track);
      void track.play().catch(() => {
        // 브라우저가 자동재생을 막은 경우 다음 사용자 시작에서 다시 생성된다.
      });
    }
  }

  private playUnit(gameplayId: string, action: 'attack' | 'death' | 'skill', volume: number): void {
    const entry = manifest.sfx[resolveAssetUnitId(gameplayId)]?.[action];
    if (entry) this.play(entry, volume);
  }

  private playMisc(id: string, volume: number): void {
    const entry = manifest.sfx.misc?.[id];
    if (entry) this.play(entry, volume);
  }

  private play(entry: AudioEntry, volume: number): void {
    const url = urlFor(entry);
    if (!url) return;
    const pool = this.voices.get(url) ?? [];
    let voice = pool.find((candidate) => candidate.paused || candidate.ended);
    if (!voice && pool.length < 4) {
      voice = new Audio(url);
      voice.preload = 'auto';
      pool.push(voice);
      this.voices.set(url, pool);
    }
    voice ??= pool[0];
    if (!voice) return;
    voice.pause();
    voice.currentTime = 0;
    voice.volume = volume;
    void voice.play().catch(() => {
      // 지원하지 않는 코덱/사용자 자동재생 정책은 전투 진행을 막지 않는다.
    });
  }
}

function urlFor(entry: AudioEntry): string | undefined {
  preferOgg ??= typeof Audio === 'undefined'
    || new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== '';
  const prefersOgg = preferOgg;
  const primary = prefersOgg ? entry.ogg : entry.mp3;
  const fallback = prefersOgg ? entry.mp3 : entry.ogg;
  return audioUrls[`../../assets/${primary}`] ?? audioUrls[`../../assets/${fallback}`];
}

export function hasUnitCombatAudio(gameplayId: string): boolean {
  const entry = manifest.sfx[resolveAssetUnitId(gameplayId)];
  return ['attack', 'death', 'skill'].every((action) => {
    const sound = entry?.[action];
    return sound !== undefined && urlFor(sound) !== undefined;
  });
}

export function hasFactionBgm(faction: 'semicon' | 'orchard'): boolean {
  const entry = manifest.bgm[faction];
  return ['bass_drums', 'synth', 'strings', 'age4'].every((layer) => {
    const track = entry?.[layer];
    return track !== undefined && urlFor(track) !== undefined;
  });
}
