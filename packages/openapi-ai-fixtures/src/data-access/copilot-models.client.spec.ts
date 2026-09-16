import { describe, expect, it } from 'vitest';

import { copilotModels } from './copilot-models.client.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

const AUTH_ERROR = processFixture('copilot-model-discovery', 'copilot-auth-error.mjs');
const MALFORMED = processFixture('copilot-model-discovery', 'copilot-malformed.mjs');
const MODELS = processFixture('copilot-model-discovery', 'copilot.mjs');
const UNSUPPORTED_PROTOCOL = processFixture('copilot-model-discovery', 'copilot-unsupported-protocol.mjs');
const UNKNOWN_POLICY = processFixture('copilot-model-discovery', 'copilot-unknown-policy.mjs');
const options = { timeoutMs: 5_000 };

describe('FEATURE: Copilot model discovery', (): void => {
  describe('GIVEN an installed SDK server with selectable models', (): void => {
    it('WHEN discovering models THEN returns provider IDs except explicitly disabled policy entries', async (): Promise<void> => {
      const models = await copilotModels({ ...options, executable: MODELS });

      expect(models).toStrictEqual(['opaque:provider/模型?deployment=production', 'unconfigured-model']);
    });
  });

  describe('GIVEN the SDK server rejects the catalog request', (): void => {
    it('WHEN discovering models THEN preserves the provider error', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: AUTH_ERROR });

      await expect(discovery).rejects.toThrow('Copilot authentication is required');
    });
  });

  describe('GIVEN the SDK server returns an incomplete catalog', (): void => {
    it('WHEN discovering models THEN rejects the malformed response', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: MALFORMED });

      await expect(discovery).rejects.toThrow('Copilot returned a model without an identifier');
    });
  });

  describe('GIVEN a server using a newer wire protocol', (): void => {
    it('WHEN discovering models THEN rejects instead of offering its catalog', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: UNSUPPORTED_PROTOCOL });

      await expect(discovery).rejects.toThrow(Error);
    });
  });

  describe('GIVEN a catalog with an unknown model policy state', (): void => {
    it('WHEN discovering models THEN rejects instead of making that model selectable', async (): Promise<void> => {
      const discovery = copilotModels({ ...options, executable: UNKNOWN_POLICY });

      await expect(discovery).rejects.toThrow(Error);
    });
  });
});
