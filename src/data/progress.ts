export interface Progress {
  rp: number;
  cleared: string[];
  research: Record<string, number>;
}

const KEY = 'tech-war-progress-v1';

export function loadProgress(): Progress {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Progress> | null;
    return { rp: value?.rp ?? 0, cleared: value?.cleared ?? [], research: value?.research ?? {} };
  } catch {
    return { rp: 0, cleared: [], research: {} };
  }
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}
