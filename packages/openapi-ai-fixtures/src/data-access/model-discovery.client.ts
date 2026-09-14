import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { isRecord } from '@fixture-automation/shared';

import type { AiTool } from '../common/ai-fixtures.type.ts';
import type { ModelDiscovery } from '../common/model.type.ts';
import { CURATED_MODELS } from '../common/models.const.ts';

// ponytail: no live list command for claude/gemini/copilot/agy; add per-harness discovery when one ships.
const CODEX_CACHE_FILE = 'models_cache.json';

const listedSlug = (entry: unknown): string | undefined => {
  if (!isRecord(entry)) return undefined;

  if (entry['visibility'] !== 'list') return undefined;

  const slug = entry['slug'];

  if (typeof slug !== 'string' || slug.length === 0) return undefined;

  return slug;
};

const cachedSlugs = (text: string): string[] => {
  const parsed: unknown = JSON.parse(text);

  if (!isRecord(parsed)) return [];

  const models = parsed['models'];

  if (!Array.isArray(models)) return [];

  const slugs: string[] = [];

  for (const entry of models) {
    const slug = listedSlug(entry);

    if (slug !== undefined) slugs.push(slug);
  }

  return slugs;
};

const codexHome = (): string => {
  const configured = process.env['CODEX_HOME'];

  if (configured !== undefined && configured.length > 0) return configured;

  return join(homedir(), '.codex');
};

const codexCacheModels = async (): Promise<string[]> => {
  try {
    const text = await readFile(join(codexHome(), CODEX_CACHE_FILE), 'utf8');

    return cachedSlugs(text);
  } catch {
    return [];
  }
};

const curatedDiscovery = (tool: AiTool): ModelDiscovery => {
  const discovery: ModelDiscovery = { models: CURATED_MODELS[tool], source: 'curated' };

  return discovery;
};

/** List a harness's selectable models, preferring its own cache and falling back to the curated list. */
export const discoverModels = async (tool: AiTool): Promise<ModelDiscovery> => {
  if (tool !== 'codex') return curatedDiscovery(tool);

  const models = await codexCacheModels();

  if (models.length === 0) return curatedDiscovery(tool);

  const discovered: ModelDiscovery = { models, source: 'codex-cache' };

  return discovered;
};
