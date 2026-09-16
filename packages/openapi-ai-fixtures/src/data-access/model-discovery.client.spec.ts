import { describe, expect, it } from 'vitest';

import { antigravityFixture } from './antigravity.client.ts';
import { discoverModels } from './model-discovery.client.ts';
import { selectModel } from './model-select.client.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

const CODEX = processFixture('model-discovery', 'codex.mjs');

describe('FEATURE: AI model discovery', (): void => {
  describe('GIVEN a provider catalog spanning multiple pages', (): void => {
    it('WHEN discovering Codex models THEN returns current visible models without duplicates', async (): Promise<void> => {
      const discovery = await discoverModels('codex', { executable: CODEX, timeoutMs: 5_000 });

      expect(discovery).toStrictEqual({ models: ['new-model-a', 'new-model-b'], source: 'codex-cli' });
    });
  });

  describe('GIVEN an unavailable provider executable', (): void => {
    it('WHEN discovering models THEN rejects instead of supplying stale model names', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'not-installed.exe');
      const discovery = discoverModels('claude', { executable, timeoutMs: 5_000 });

      await expect(discovery).rejects.toThrow(/claude.*model discovery/i);
    });
  });

  describe('GIVEN provider authentication fails during discovery', (): void => {
    it('WHEN requesting the catalog THEN preserves the provider error without a fallback', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'failure.mjs');
      const discovery = discoverModels('codex', { executable, timeoutMs: 5_000 });

      await expect(discovery).rejects.toThrow('Catalog authentication required');
    });
  });

  describe('GIVEN the provider returns an empty catalog', (): void => {
    it('WHEN requesting models THEN fails instead of misreporting missing model support', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'failure.mjs');
      const discovery = discoverModels('antigravity', { executable, timeoutMs: 5_000 });

      await expect(discovery).rejects.toThrow('Provider returned no selectable models');
    });
  });

  describe('GIVEN the provider closes before returning its catalog', (): void => {
    it('WHEN discovering THEN rejects the incomplete exchange', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'closed.mjs');
      const discovery = discoverModels('claude', { executable, timeoutMs: 5_000 });

      await expect(discovery).rejects.toThrow('closed before returning its model catalog');
    });
  });

  describe('GIVEN Claude reports current models and custom aliases', (): void => {
    it('WHEN discovering THEN uses the CLI values rather than a package catalog', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'claude.mjs');
      const discovery = await discoverModels('claude', { executable, timeoutMs: 5_000 });

      expect(discovery).toStrictEqual({ models: ['new-claude-model', 'custom-alias'], source: 'claude-cli' });
    });
  });

  describe('GIVEN Antigravity reports a selectable model', (): void => {
    it('WHEN selecting and generating THEN accepts the discovered model end to end', async (): Promise<void> => {
      const executable = processFixture('model-discovery', 'antigravity.mjs');
      const discovery = await discoverModels('antigravity', { executable, timeoutMs: 5_000 });
      const prompt = async (): Promise<string> => Promise.resolve('1');
      const model = await selectModel({ tool: 'antigravity', interactive: true, discovery, prompt });
      const options = { tool: 'antigravity', executable, model, timeoutMs: 5_000 } as const;

      const result = await antigravityFixture({ prompt: 'Return an open fixture', options });

      expect(result).toBe('{"status":"open"}');
    });
  });
});
