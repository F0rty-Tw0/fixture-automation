import { describe, expect, it } from 'vitest';

import { copilotModels } from './copilot-models.client.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

const AUTH_ERROR = processFixture('copilot-model-discovery', 'copilot-auth-error.mjs');
const LEGACY_MODELS = processFixture('copilot-model-discovery', 'copilot-legacy-models.mjs');
const MALFORMED = processFixture('copilot-model-discovery', 'copilot-malformed.mjs');
const MODELS = processFixture('copilot-model-discovery', 'copilot.mjs');
const UNSUPPORTED_PROTOCOL = processFixture('copilot-model-discovery', 'copilot-unsupported-protocol.mjs');
const options = { timeoutMs: 5_000 };

describe('FEATURE: Copilot model discovery', (): void => {
  describe('GIVEN an ACP session exposing a model configuration option', (): void => {
    it('WHEN discovering models THEN returns every grouped option value once', async (): Promise<void> => {
      const models = await copilotModels({ ...options, executable: MODELS });

      expect(models).toStrictEqual(['gpt-fixture', 'opaque:provider/模型?deployment=production']);
    });
  });

  describe('GIVEN an ACP session exposing the legacy available-models catalog', (): void => {
    it('WHEN discovering models THEN returns the provider model identifiers', async (): Promise<void> => {
      const models = await copilotModels({ ...options, executable: LEGACY_MODELS });

      expect(models).toStrictEqual(['legacy-a', 'legacy-b']);
    });
  });

  describe('GIVEN the ACP agent rejects the session request', (): void => {
    it('WHEN discovering models THEN preserves the provider error', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: AUTH_ERROR });

      await expect(discovery).rejects.toThrow('Copilot authentication is required');
    });
  });

  describe('GIVEN the ACP agent returns an incomplete catalog', (): void => {
    it('WHEN discovering models THEN rejects the malformed response', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: MALFORMED });

      await expect(discovery).rejects.toThrow('Provider returned a model without an identifier');
    });
  });

  describe('GIVEN an agent using a newer ACP protocol version', (): void => {
    it('WHEN discovering models THEN rejects instead of offering its catalog', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: UNSUPPORTED_PROTOCOL });

      await expect(discovery).rejects.toThrow('Copilot returned an unsupported ACP protocol version');
    });
  });
});
