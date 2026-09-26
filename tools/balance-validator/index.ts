import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { crossValidate } from './cross-validate.js';
import type { BalanceDocuments, ValidationIssue, ValidationResult } from './types.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataRoot = path.join(root, 'src', 'data');

const targets = [
  ['balance/meta.json', 'schema/meta.schema.json'],
  ['balance/factions.json', 'schema/faction.schema.json'],
  ['balance/ages.json', 'schema/age.schema.json'],
  ['balance/upgrades.json', 'schema/upgrade.schema.json'],
  ['balance/strategies.json', 'schema/strategy.schema.json'],
  ['balance/damage_matrix.json', 'schema/damage-matrix.schema.json'],
  ['balance/units/semicon.json', 'schema/unit.schema.json'],
  ['balance/units/orchard.json', 'schema/unit.schema.json'],
  ['balance/skills/semicon.json', 'schema/skill.schema.json'],
  ['balance/skills/orchard.json', 'schema/skill.schema.json'],
  ['balance/ai/difficulties.json', 'schema/ai.schema.json'],
  ['balance/ai/counters.json', 'schema/counter.schema.json'],
  ['campaign/stages.json', 'schema/stage.schema.json'],
  ['meta/research_tree.json', 'schema/research.schema.json'],
  ['assets.manifest.json', 'schema/asset-manifest.schema.json']
] as const;

async function readJson(relativePath: string): Promise<Record<string, unknown>> {
  const text = await readFile(path.join(dataRoot, relativePath), 'utf8');
  return JSON.parse(text) as Record<string, unknown>;
}

function formatAjvIssue(file: string, issue: ErrorObject): ValidationIssue {
  return {
    severity: 'error',
    file,
    path: issue.instancePath || '/',
    message: issue.message ?? issue.keyword
  };
}

export async function validateBalance(): Promise<ValidationResult> {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const issues: ValidationIssue[] = [];
  const cache = new Map<string, Record<string, unknown>>();
  const validators = new Map<string, ValidateFunction>();

  for (const [dataFile, schemaFile] of targets) {
    try {
      const data = await readJson(dataFile);
      cache.set(dataFile, data);
      let validate = validators.get(schemaFile);
      if (!validate) {
        const schema = await readJson(schemaFile);
        validate = ajv.compile(schema);
        validators.set(schemaFile, validate);
      }
      if (!validate(data)) issues.push(...(validate.errors ?? []).map((issue) => formatAjvIssue(dataFile, issue)));
    } catch (cause) {
      issues.push({ severity: 'error', file: dataFile, path: '/', message: cause instanceof Error ? cause.message : String(cause) });
    }
  }

  if (!issues.some((issue) => issue.severity === 'error')) {
    const getArray = (file: string, key: string): Array<Record<string, unknown>> => (cache.get(file)?.[key] as Array<Record<string, unknown>>) ?? [];
    const documents: BalanceDocuments = {
      meta: cache.get('balance/meta.json') ?? {},
      units: [...getArray('balance/units/semicon.json', 'units'), ...getArray('balance/units/orchard.json', 'units')],
      skills: [...getArray('balance/skills/semicon.json', 'skills'), ...getArray('balance/skills/orchard.json', 'skills')],
      factions: getArray('balance/factions.json', 'factions'),
      ages: getArray('balance/ages.json', 'ages'),
      upgrades: getArray('balance/upgrades.json', 'upgrades'),
      strategies: getArray('balance/strategies.json', 'strategies'),
      difficulties: getArray('balance/ai/difficulties.json', 'difficulties'),
      counters: (cache.get('balance/ai/counters.json')?.counters as BalanceDocuments['counters']) ?? {},
      damageMatrix: cache.get('balance/damage_matrix.json') ?? {},
      stages: getArray('campaign/stages.json', 'stages'),
      research: cache.get('meta/research_tree.json') ?? {},
      assetManifest: cache.get('assets.manifest.json') ?? {}
    };
    issues.push(...crossValidate(documents));
  }

  return { issues, filesChecked: targets.length };
}

async function main(): Promise<void> {
  const result = await validateBalance();
  for (const issue of result.issues) {
    const icon = issue.severity === 'error' ? 'ERROR' : 'WARN ';
    const separator = issue.path.startsWith('/') ? '' : '/';
    process.stdout.write(`${icon} ${issue.file}${separator}${issue.path}: ${issue.message}\n`);
  }
  const errors = result.issues.filter((issue) => issue.severity === 'error').length;
  const warnings = result.issues.filter((issue) => issue.severity === 'warning').length;
  process.stdout.write(`Checked ${result.filesChecked} files: ${errors} error(s), ${warnings} warning(s).\n`);
  if (errors > 0) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await main();
