import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { saveFailedResponse } from './agent-response-file.client.ts';
import { generateFixture } from './fixture-agent.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';
import type { AiTool } from '../common/ai-fixtures.type.ts';
import { modelRequest } from '../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../test/utils/agent-response.spec.util.ts';
import { AgentJsonError } from '../utils/agent-json.error.ts';

vi.mock('./agent-process.client.ts');
vi.mock('./agent-response-file.client.ts');

describe('FEATURE: fixture JSON recovery', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN a provider returns malformed fixture JSON and then a valid correction', (): void => {
    it.each<AiTool>(['claude', 'codex', 'antigravity', 'copilot', 'gemini'])(
      'WHEN generating with %s THEN returns the parsed correction and its exact response',
      async (tool: AiTool): Promise<void> => {
        const malformed = '{"id":';
        const corrected = '{\n  "id": "recovered"\n}';

        vi.mocked(runAgent).mockResolvedValueOnce(agentResponse(tool, malformed));
        vi.mocked(runAgent).mockResolvedValueOnce(agentResponse(tool, corrected));

        const result = await generateFixture(modelRequest(tool));

        expect(result.value).toStrictEqual({ id: 'recovered' });
        expect(result.response).toBe(corrected);
        expect(result.attempt).toBe(2);
        expect(runAgent).toHaveBeenCalledTimes(2);
      }
    );
  });

  describe('GIVEN the initial provider response contains valid JSON', (): void => {
    it('WHEN generating THEN returns the parsed value and the exact first response', async (): Promise<void> => {
      const response = '{\n  "id": "first"\n}';

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', response));

      const result = await generateFixture(modelRequest('claude'));

      expect(result.value).toStrictEqual({ id: 'first' });
      expect(result.response).toBe(response);
      expect(result.attempt).toBe(1);
      expect(saveFailedResponse).not.toHaveBeenCalled();
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN both model responses contain invalid JSON', (): void => {
    it('WHEN generating THEN saves both responses and stops after two attempts', async (): Promise<void> => {
      const initial = '{"id":';
      const correction = '{"id":"second",}';

      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', initial));
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', correction));

      const failure = generateFixture(modelRequest('claude'));

      await expect(failure).rejects.toThrow(AgentJsonError);
      await expect(failure).rejects.toThrow(/invalid JSON.*2 attempts/);
      await expect(failure).rejects.toHaveProperty('response', correction);
      expect(saveFailedResponse).toHaveBeenNthCalledWith(1, { tool: 'claude' }, initial, 1);
      expect(saveFailedResponse).toHaveBeenNthCalledWith(2, { tool: 'claude' }, correction, 2);
      expect(runAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('GIVEN failed-response persistence fails', (): void => {
    it('WHEN the initial response is malformed THEN preserves the persistence failure without retrying', async (): Promise<void> => {
      const failure = new Error('failed response could not be saved');

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', '{"id":'));
      vi.mocked(saveFailedResponse).mockRejectedValue(failure);

      const result = generateFixture(modelRequest('claude'));

      await expect(result).rejects.toBe(failure);
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN the provider transport is malformed', (): void => {
    it('WHEN generating THEN fails without saving or asking the model to repair the transport', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue('{not JSON');

      const result = generateFixture(modelRequest('claude'));

      await expect(result).rejects.toThrow(Error);
      expect(saveFailedResponse).not.toHaveBeenCalled();
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN the provider reports authentication failure', (): void => {
    it('WHEN generating THEN reports the provider failure without retrying', async (): Promise<void> => {
      const response = JSON.stringify({ type: 'result', subtype: 'error', is_error: true, result: 'Authentication failed' });

      vi.mocked(runAgent).mockResolvedValue(response);

      const result = generateFixture(modelRequest('claude'));

      await expect(result).rejects.toThrow(/Authentication failed/);
      expect(saveFailedResponse).not.toHaveBeenCalled();
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN the tool process times out', (): void => {
    it('WHEN generating THEN preserves the process failure without retrying', async (): Promise<void> => {
      const failure = new Error('Agent execution timed out');

      vi.mocked(runAgent).mockRejectedValue(failure);

      const result = generateFixture(modelRequest('claude'));

      await expect(result).rejects.toBe(failure);
      expect(saveFailedResponse).not.toHaveBeenCalled();
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe('GIVEN the correction process fails', (): void => {
    it('WHEN generating THEN preserves that failure without a third attempt', async (): Promise<void> => {
      const failure = new Error('Agent execution timed out');

      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', '{"id":'));
      vi.mocked(runAgent).mockRejectedValueOnce(failure);

      const result = generateFixture(modelRequest('claude'));

      await expect(result).rejects.toBe(failure);
      expect(saveFailedResponse).toHaveBeenCalledTimes(1);
      expect(runAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('GIVEN generation is canceled after malformed output', (): void => {
    it('WHEN a correction would start THEN saves the response and honors cancellation without another invocation', async (): Promise<void> => {
      const controller = new AbortController();
      const failure = new Error('generation canceled');
      const base = modelRequest('claude');
      const options = { ...base.options, signal: controller.signal };
      const request: AgentRequest = { ...base, options };

      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', '{"id":'));

      const result = generateFixture(request);

      controller.abort(failure);

      await expect(result).rejects.toBe(failure);
      expect(saveFailedResponse).toHaveBeenCalledWith(options, '{"id":', 1);
      expect(runAgent).toHaveBeenCalledTimes(1);
    });
  });
});
