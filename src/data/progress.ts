import stages from './campaign/stages.json';
import researchTree from './meta/research_tree.json';

export interface Progress {
  rp: number;
  cleared: string[];
  research: Record<string, number>;
}

const KEY = 'tech-war-progress-v1';
const STAGE_IDS = new Set(stages.stages.map((stage) => stage.id));
const RESEARCH_LEVELS = new Map(researchTree.nodes.map((node) => [node.id, node.levels.length]));
const EMPTY = (): Progress => ({ rp: 0, cleared: [], research: {} });
let volatileProgress: Progress | null = null;

/** 저장소 데이터가 오래되거나 손상되어도 화면과 경기 수치를 안전하게 유지한다. */
export function sanitizeProgress(value: unknown): Progress {
  if (!value || typeof value !== 'object') return EMPTY();
  const raw = value as Record<string, unknown>;
  const rp = typeof raw.rp === 'number' && Number.isFinite(raw.rp)
    ? Math.max(0, Math.min(1_000_000_000, Math.floor(raw.rp))) : 0;
  const cleared = Array.isArray(raw.cleared)
    ? [...new Set(raw.cleared.filter((id): id is string => typeof id === 'string' && STAGE_IDS.has(id)))]
    : [];
  const research: Record<string, number> = {};
  if (raw.research && typeof raw.research === 'object' && !Array.isArray(raw.research)) {
    for (const [id, level] of Object.entries(raw.research)) {
      const max = RESEARCH_LEVELS.get(id);
      if (max === undefined || typeof level !== 'number' || !Number.isInteger(level)) continue;
      research[id] = Math.max(0, Math.min(max, level));
    }
  }
  return { rp, cleared, research };
}

export function loadProgress(): Progress {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) return sanitizeProgress(JSON.parse(stored));
  } catch { /* 저장소 접근이 제한되면 현재 탭의 임시 진행을 사용한다. */ }
  return sanitizeProgress(volatileProgress);
}

/** 영구 저장 성공 여부. 저장소가 막혀도 현재 탭에서는 진행을 유지한다. */
export function saveProgress(progress: Progress): boolean {
  const safe = sanitizeProgress(progress);
  volatileProgress = safe;
  try {
    localStorage.setItem(KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
