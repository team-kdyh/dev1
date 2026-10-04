export interface AudioSettings {
  music: number;
  effects: number;
}

const STORAGE_KEY = 'tech-war-audio-v1';
const DEFAULT_SETTINGS: AudioSettings = { music: 1, effects: 1 };

function clampVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 1;
}

export function loadAudioSettings(): AudioSettings {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(saved) as Partial<AudioSettings>;
    return {
      music: clampVolume(parsed.music),
      effects: clampVolume(parsed.effects),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장을 차단한 브라우저에서도 현재 화면의 조작은 유지한다.
  }
}
