import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateFixture } from './fixture-agent.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import { AgentJsonError } from '../../agent-provider/common/agent-json.error.ts';
import type { AgentRequest } from '../../agent-provider/common/agent-provider.type.ts';
import type { AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { fileRequest, modelRequest } from '../../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';
import type { FixtureCheck } from '../common/agent-fixture.type.ts';
import { saveFailedResponse } from '../data-access/agent-response-file.client.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');
vi.mock('../data-access/agent-response-file.client.ts');

describe('FEATURE: fixture JSON recovery', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN a provider returns malformed fixture JSON and then a fenced correction', (): void => {
    it.each<AiTool>(['claude', 'codex', 'antigravity', 'copilot', 'gemini'])(
      'WHEN generating with %s THEN returns the parsed correction and its exact response',
      async (tool: AiTool): Promise<void> => {
        const malformed = '{"id":';
        const corrected = '```json\n{\n  "id": "recovered"\n}\n```';

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

  describe('GIVEN Gemini wraps a valid initial response in a JSON code fence', (): void => {
    it('WHEN generating THEN returns the parsed value and the exact first response', async (): Promise<void> => {
      const response = '```json\n{\n  "id": "first"\n}\n```';

      vi.mocked(runAgent).mockResolvedValue(agentResponse('gemini', response));

      const result = await generateFixture(modelRequest('gemini'));

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

  describe('GIVEN a check rejects the first parsed answer', (): void => {
    const check = async (value: unknown): Promise<string | undefined> => {
      const isRecovered = JSON.stringify(value) === '{"id":"recovered"}';
      const problem = isRecovered ? undefined : '/id: must be recovered';

      return Promise.resolve(problem);
    };

    it('WHEN the correction passes THEN returns it after one repair that names the problem', async (): Promise<void> => {
      const first = '{"id":"wrong"}';
      const corrected = '{"id":"recovered"}';

      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', first));
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', corrected));

      const result = await generateFixture(modelRequest('claude'), check);
      const [, repairCall] = vi.mocked(runAgent).mock.calls;

      const recovered = { id: 'recovered' };

      expect(result).toStrictEqual({
        value: recovered,
        isRecovered: false,
        alternatives: [],
        response: corrected,
        attempt: 2,
        problem: undefined
      });
      expect(repairCall?.[0].input).toContain('/id: must be recovered');
      expect(saveFailedResponse).toHaveBeenCalledWith({ tool: 'claude' }, first, 1);
    });

    it('WHEN the repair prompt would exceed the input limit THEN returns the first answer with its problem', async (): Promise<void> => {
      const first = '{"id":"wrong"}';
      const base = modelRequest('claude');
      const request: AgentRequest = { ...base, prompt: 'x'.repeat(1024 * 1024 - 64) };

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', first));

      const result = await generateFixture(request, check);

      expect(result.attempt).toBe(1);
      expect(result.response).toBe(first);
      expect(result.problem).toBe('/id: must be recovered');
      expect(runAgent).toHaveBeenCalledTimes(1);
      expect(saveFailedResponse).not.toHaveBeenCalled();
    });

    it('WHEN the correction fails the check too THEN returns it with the problem and no third attempt', async (): Promise<void> => {
      const wrong = '{"id":"wrong"}';

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', wrong));

      const result = await generateFixture(modelRequest('claude'), check);

      expect(result.attempt).toBe(2);
      expect(result.problem).toBe('/id: must be recovered');
      expect(runAgent).toHaveBeenCalledTimes(2);
    });
  });

  describe('GIVEN an answer recovered from prose', (): void => {
    it('WHEN checked THEN the check learns it was recovered and sees the other candidates', async (): Promise<void> => {
      const check = vi.fn<FixtureCheck>(async (): Promise<string | undefined> => Promise.resolve(undefined));
      const prose = 'Per the spec [1], here it is: {"id":"in_1"}';

      vi.mocked(runAgent).mockResolvedValue(agentResponse('claude', prose));

      await generateFixture(modelRequest('claude'), check);

      const value = { id: 'in_1' };
      const parsed = { value, isRecovered: true, alternatives: [[1]], response: prose, attempt: 1 };

      expect(check).toHaveBeenCalledWith(value, parsed);
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

  describe('GIVEN a request that stages files and a malformed first answer', (): void => {
    beforeEach((): void => {
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', '{"id":'));
      vi.mocked(runAgent).mockResolvedValueOnce(agentResponse('claude', '{"id":"recovered"}'));
    });

    it('WHEN generating THEN the first attempt stages the files', async (): Promise<void> => {
      const request = fileRequest('claude');

      await generateFixture(request);

      const [firstCall] = vi.mocked(runAgent).mock.calls;

      expect(firstCall?.[0].files).toStrictEqual(request.files);
    });

    it('WHEN generating THEN the repair attempt stages the same files', async (): Promise<void> => {
      const request = fileRequest('claude');

      await generateFixture(request);

      const [, repairCall] = vi.mocked(runAgent).mock.calls;

      expect(repairCall?.[0].files).toStrictEqual(request.files);
    });
  });
});
