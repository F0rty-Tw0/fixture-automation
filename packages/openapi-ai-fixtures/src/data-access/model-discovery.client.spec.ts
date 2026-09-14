import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverModels } from './model-discovery.client.ts';
import type { AiTool } from '../common/ai-fixtures.type.ts';
import { CURATED_MODELS } from '../common/models.const.ts';

const codexHome = (name: string): string => {
  const url = new URL(`../test/fixtures/${name}`, import.meta.url);

  return fileURLToPath(url);
};

const malformedHome = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'codex-home-'));

  await writeFile(join(directory, 'models_cache.json'), '{ "models": [ not json');

  return directory;
};

const curatedTools: AiTool[] = ['claude', 'antigravity', 'copilot', 'gemini'];

describe('FEATURE: AI model discovery', (): void => {
  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  describe('GIVEN a Codex cache listing both visible and hidden models', (): void => {
    it('WHEN codex models are discovered THEN returns the listed slugs in cache order', async (): Promise<void> => {
      vi.stubEnv('CODEX_HOME', codexHome('codex-home'));

      const discovery = await discoverModels('codex');

      expect(discovery).toStrictEqual({ models: ['gpt-cache-a', 'gpt-cache-b'], source: 'codex-cache' });
    });
  });

  describe('GIVEN a Codex home without a readable model cache', (): void => {
    it('WHEN codex models are discovered THEN falls back to the curated list', async (): Promise<void> => {
      vi.stubEnv('CODEX_HOME', codexHome('codex-home-absent'));

      const discovery = await discoverModels('codex');

      expect(discovery).toStrictEqual({ models: CURATED_MODELS.codex, source: 'curated' });
    });
  });

  describe('GIVEN a Codex cache whose payload is not a model list', (): void => {
    it('WHEN codex models are discovered THEN falls back to the curated list', async (): Promise<void> => {
      vi.stubEnv('CODEX_HOME', codexHome('codex-home-invalid'));

      const discovery = await discoverModels('codex');

      expect(discovery).toStrictEqual({ models: CURATED_MODELS.codex, source: 'curated' });
    });
  });

  describe('GIVEN a Codex cache that is not valid JSON', (): void => {
    it('WHEN codex models are discovered THEN falls back to the curated list', async (): Promise<void> => {
      const directory = await malformedHome();

      vi.stubEnv('CODEX_HOME', directory);

      try {
        const discovery = await discoverModels('codex');

        expect(discovery).toStrictEqual({ models: CURATED_MODELS.codex, source: 'curated' });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  });

  describe('GIVEN a harness without a live model list', (): void => {
    it.each(curatedTools)('WHEN %s models are discovered THEN returns the curated list', async (tool: AiTool): Promise<void> => {
      const discovery = await discoverModels(tool);

      expect(discovery).toStrictEqual({ models: CURATED_MODELS[tool], source: 'curated' });
    });
  });
});
