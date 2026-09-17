import assert from 'node:assert/strict';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { antigravityModels } from './antigravity-models.client.ts';
import { agentArgs } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const discoverWith = async (envelope: unknown): Promise<string[]> => {
  vi.mocked(runAgent).mockResolvedValue(JSON.stringify(envelope));

  return antigravityModels({ timeoutMs: 5_000 });
};

const modelsCommand = (data: unknown): Record<string, unknown> => {
  const command = { name: 'models', data };

  return command;
};

describe('FEATURE: Antigravity model discovery', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN a successful models command result', (): void => {
    it('WHEN discovering THEN returns the catalog ids', async (): Promise<void> => {
      const models = [{ id: 'model-a' }, { id: 'model-b', hidden: true }];

      const discovered = await discoverWith({ status: 'SUCCESS', command: modelsCommand({ models }) });

      expect(discovered).toStrictEqual(['model-a']);
    });

    it('WHEN discovering THEN runs the JSON models command without input', async (): Promise<void> => {
      const models = [{ id: 'model-a' }];
      const data = { models };

      await discoverWith({ status: 'SUCCESS', command: modelsCommand(data) });

      const [call] = vi.mocked(runAgent).mock.calls;

      assert(call !== undefined);
      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toStrictEqual(['--output-format', 'json', 'models']);
      expect(call[0].executable).toBe('agy');
      expect(call[0].input).toBe('');
      expect(call[1].tool).toBe('antigravity');
    });
  });

  describe('GIVEN a rejected models command', (): void => {
    it('WHEN the status is not SUCCESS THEN rejects the discovery', async (): Promise<void> => {
      await expect(discoverWith({ status: 'ERROR', command: modelsCommand({ models: [] }) })).rejects.toThrow(
        'Antigravity rejected model discovery'
      );
    });
  });

  describe('GIVEN a success envelope without a models command result', (): void => {
    it('WHEN the command is missing THEN rejects the missing result', async (): Promise<void> => {
      await expect(discoverWith({ status: 'SUCCESS' })).rejects.toThrow('Antigravity returned no models command result');
    });

    it('WHEN the command names another command THEN rejects the missing result', async (): Promise<void> => {
      const command = { name: 'status', data: {} };

      await expect(discoverWith({ status: 'SUCCESS', command })).rejects.toThrow('Antigravity returned no models command result');
    });

    it('WHEN the command carries no data object THEN rejects the missing catalog', async (): Promise<void> => {
      await expect(discoverWith({ status: 'SUCCESS', command: modelsCommand(null) })).rejects.toThrow(
        'Antigravity returned no model catalog'
      );
    });
  });
});
