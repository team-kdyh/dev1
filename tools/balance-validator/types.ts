export interface ValidationIssue {
  severity: 'error' | 'warning';
  file: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  filesChecked: number;
}

export interface BalanceDocuments {
  meta: Record<string, unknown>;
  units: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  factions: Array<Record<string, unknown>>;
  ages: Array<Record<string, unknown>>;
  upgrades: Array<Record<string, unknown>>;
  strategies: Array<Record<string, unknown>>;
  difficulties: Array<Record<string, unknown>>;
  counters: Record<string, Array<Record<string, unknown>>>;
  damageMatrix: Record<string, unknown>;
  stages: Array<Record<string, unknown>>;
  research: Record<string, unknown>;
  assetManifest: Record<string, unknown>;
}
