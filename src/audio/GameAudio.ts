import manifestJson from '../../assets/audio/manifest.json';
import { artIdOf } from '../data/gameData';
import type { SimEvent, Snapshot } from '../sim/contracts';
import { loadAudioSettings } from './settings';
import { assetUrl } from '../assets/assetUrl';

type Sound = { ogg: string; mp3: string; loopStart?: number; loopEnd?: number };
type AudioManifest = { sampleRate: number; sfx: Record<string, Record<string, Sound>>;
  bgm: Record<string, Record<string, Sound>> };
const manifest = manifestJson as AudioManifest;

export class GameAudio {
  private readonly settings = loadAudioSettings();
  private readonly context = new AudioContext();
  private readonly buffers = new Map<string, Promise<AudioBuffer>>();
  private readonly lastPlayed = new Map<string, number>();
  private readonly music: AudioBufferSourceNode[] = [];
  private readonly gains: GainNode[] = [];
  private musicStart = 0;
  private age4Started = false;
  private get closed(): boolean { return this.context.state === 'closed'; }

  constructor(private readonly faction: string) {
    void this.context.resume();
    void this.startMusic();
  }

  private async decode(sound: Sound): Promise<AudioBuffer> {
    const key = sound.ogg;
    let promise = this.buffers.get(key);
    if (!promise) {
      promise = (async () => {
        for (const path of [sound.ogg, sound.mp3]) {
          try {
            const response = await fetch(assetUrl(path));
            if (!response.ok) continue;
            return await this.context.decodeAudioData(await response.arrayBuffer());
          } catch { /* try the alternate format */ }
        }
        throw new Error('Audio file could not be decoded: ' + key);
      })();
      this.buffers.set(key, promise);
    }
    return promise;
  }

  private async startMusic(): Promise<void> {
    if (this.settings.music <= 0) return;
    const layers = manifest.bgm[this.faction];
    if (!layers) return;
    try {
      const names = ['bass_drums', 'synth', 'strings'];
      const buffers = await Promise.all(names.map((name) => this.decode(layers[name])));
      if (this.closed) return;
      this.musicStart = this.context.currentTime + 0.1;
      buffers.forEach((buffer, index) => this.startLayer(buffer, layers[names[index]], this.musicStart,
        (index === 0 ? 0.15 : 0.08) * this.settings.music));
    } catch (error) { console.error(error); }
  }

  private startLayer(buffer: AudioBuffer, sound: Sound, when: number, volume: number): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = (sound.loopStart ?? 0) / manifest.sampleRate;
    source.loopEnd = (sound.loopEnd ?? buffer.length) / manifest.sampleRate;
    gain.gain.value = volume;
    source.connect(gain).connect(this.context.destination);
    source.start(Math.max(this.context.currentTime, when));
    this.music.push(source);
    this.gains.push(gain);
  }

  private async startAge4(): Promise<void> {
    if (this.settings.music <= 0) return;
    if (this.age4Started) return;
    this.age4Started = true;
    const sound = manifest.bgm[this.faction]?.age4;
    if (!sound) return;
    try {
      const buffer = await this.decode(sound);
      if (this.closed) return;
      const length = (sound.loopEnd ?? buffer.length) / manifest.sampleRate;
      const elapsed = Math.max(0, this.context.currentTime - this.musicStart);
      const next = this.musicStart + Math.ceil(elapsed / length) * length;
      this.startLayer(buffer, sound, next, 0.1 * this.settings.music);
    } catch (error) { console.error(error); }
  }

  private async play(sound: Sound | undefined, volume = 0.24): Promise<void> {
    if (!sound || this.closed || this.settings.effects <= 0) return;
    const key = sound.ogg;
    const now = this.context.currentTime;
    if (now - (this.lastPlayed.get(key) ?? -1) < 0.07) return;
    this.lastPlayed.set(key, now);
    try {
      const buffer = await this.decode(sound);
      if (this.closed) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      gain.gain.value = volume * this.settings.effects;
      source.connect(gain).connect(this.context.destination);
      source.start();
    } catch (error) { console.error(error); }
  }

  handle(events: readonly SimEvent[], snapshot: Snapshot): void {
    for (const event of events) {
      if (event.type === 'attack') {
        void this.play(manifest.sfx[artIdOf(event.defId)]?.attack);
      } else if (event.type === 'kill') {
        void this.play(manifest.sfx[artIdOf(event.defId)]?.death);
      } else if (event.type === 'skill') {
        const unit = snapshot.units.find((item) => item.id === event.unitId);
        if (unit) void this.play(manifest.sfx[artIdOf(unit.defId)]?.skill);
      } else if (event.type === 'spawn' && snapshot.units.find((item) => item.id === event.unitId)?.tier === 9) {
        void this.play(manifest.sfx.misc[event.owner === 0 ? 't9_semicon_cutin' : 't9_orchard_cutin']);
      } else if (event.type === 'baseHit') {
        void this.play(manifest.sfx.misc.base_hit, 0.16);
      } else if (event.type === 'ageup') {
        void this.play(manifest.sfx.misc.age_up);
        if (event.owner === snapshot.me && event.age === 4) void this.startAge4();
      } else if (event.type === 'strategy') {
        void this.play(manifest.sfx.misc[(event.owner === 0 ? 'semicon_' : 'orchard_') + event.strategyId]);
      } else if (event.type === 'rejected' && (event.owner === undefined || event.owner === snapshot.me)) {
        void this.play(manifest.sfx.misc.purchase_fail, 0.15);
      } else if (event.type === 'gameOver') {
        void this.play(manifest.sfx.misc[event.winner === null ? 'ui_transition' :
          event.winner === snapshot.me ? 'victory' : 'defeat'], 0.35);
      }
    }
  }

  click(): void { void this.play(manifest.sfx.misc.button_click, 0.12); }

  /** 본진 체력 25% 경고: 음량 설정을 따르는 짧은 두 번의 전자 비프음. */
  warning(): void {
    if (this.closed || this.settings.effects <= 0) return;
    const now = this.context.currentTime;
    for (const offset of [0, 0.18]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = now + offset;
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(740, start);
      oscillator.frequency.exponentialRampToValueAtTime(520, start + 0.12);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045 * this.settings.effects, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
      oscillator.connect(gain).connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.14);
    }
  }

  stop(): void {
    for (const gain of this.gains) gain.gain.setTargetAtTime(0, this.context.currentTime, 0.04);
    window.setTimeout(() => { void this.context.close(); }, 180);
  }
}
