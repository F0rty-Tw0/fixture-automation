import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { geminiModels } from './gemini-models.client.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

const GEMINI = processFixture('model-discovery', 'gemini.mjs');
const GEMINI_SYSTEM_AUTO_MEMORY = processFixture('model-discovery', 'gemini-system-auto-memory.json');
const GEMINI_SYSTEM_DEFAULTS = processFixture('model-discovery', 'gemini-system-defaults.json');
const GEMINI_SYSTEM_HOOKS = processFixture('model-discovery', 'gemini-system-hooks.json');
const GEMINI_SYSTEM_SAFE = processFixture('model-discovery', 'gemini-system-safe.json');

describe('FEATURE: Gemini model discovery', (): void => {
  beforeEach((): void => {
    vi.stubEnv('GEMINI_RESTRICTED_MODE', 'false');
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  describe('GIVEN a Gemini ACP catalog and isolated discovery settings', (): void => {
    it('WHEN discovering models THEN returns the provider model identifiers after protocol completion', async (): Promise<void> => {
      vi.stubEnv('GEMINI_CLI_SYSTEM_SETTINGS_PATH', GEMINI_SYSTEM_SAFE);
      vi.stubEnv('GEMINI_CLI_SYSTEM_DEFAULTS_PATH', GEMINI_SYSTEM_DEFAULTS);

      const models = await geminiModels({
        executable: GEMINI,
        timeoutMs: 5_000
      });

      expect(models).toStrictEqual(['provider-model', 'provider-auto']);
    });
  });

  describe('GIVEN managed system settings enable Auto Memory', (): void => {
    it('WHEN discovering models THEN rejects before starting an unsafe catalog session', async (): Promise<void> => {
      vi.stubEnv('GEMINI_CLI_SYSTEM_SETTINGS_PATH', GEMINI_SYSTEM_AUTO_MEMORY);

      const models = geminiModels({
        executable: GEMINI,
        timeoutMs: 5_000
      });

      await expect(models).rejects.toThrow(/system settings enable Auto Memory/);
    });
  });

  describe('GIVEN managed system settings enable hooks', (): void => {
    it('WHEN discovering models THEN rejects before starting an unsafe catalog session', async (): Promise<void> => {
      vi.stubEnv('GEMINI_CLI_SYSTEM_SETTINGS_PATH', GEMINI_SYSTEM_HOOKS);

      const models = geminiModels({
        executable: GEMINI,
        timeoutMs: 5_000
      });

      await expect(models).rejects.toThrow(/system settings enable hooks/);
    });
  });
});
