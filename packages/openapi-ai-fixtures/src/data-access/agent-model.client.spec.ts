import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { claudeFixture } from './claude.client.ts';
import { copilotFixture } from './copilot.client.ts';
import { geminiFixture } from './gemini.client.ts';
import { agentArgs, modelRequest } from '../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../test/utils/agent-response.spec.util.ts';

vi.mock('./agent-process.client.ts');

const claudeResult = { type: 'result', subtype: 'success', is_error: false, result: '{}' };
const claudeEnvelope = JSON.stringify(claudeResult);
const geminiEnvelope = agentResponse('gemini', '{}');
const hasModelFlag = (argument: string): boolean => argument.startsWith('--model');

describe('FEATURE: AI model passthrough per harness', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN a selected Claude model', (): void => {
    it('WHEN the fixture is requested THEN appends --model and the slug', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(claudeEnvelope);

      await claudeFixture(modelRequest('claude', 'opus'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).slice(-2)).toStrictEqual(['--model', 'opus']);
    });

    it('WHEN the harness default is selected THEN appends no model flag', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(claudeEnvelope);

      await claudeFixture(modelRequest('claude', 'default'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).not.toContain('--model');
    });
  });

  describe('GIVEN a selected Gemini model', (): void => {
    it('WHEN the fixture is requested THEN appends -m and the slug', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

      await geminiFixture(modelRequest('gemini', 'gemini-3-pro'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).slice(-2)).toStrictEqual(['-m', 'gemini-3-pro']);
    });

    it('WHEN the model is omitted THEN appends no model flag', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

      await geminiFixture(modelRequest('gemini'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).not.toContain('-m');
    });
  });

  describe('GIVEN a selected Copilot model', (): void => {
    it('WHEN the fixture is requested THEN appends the joined --model argument', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue('{}');

      await copilotFixture(modelRequest('copilot', 'gpt-5'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).at(-1)).toBe('--model=gpt-5');
    });

    it('WHEN the model is omitted THEN appends no model flag', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue('{}');

      await copilotFixture(modelRequest('copilot'));

      expect(agentArgs(vi.mocked(runAgent).mock.calls).some(hasModelFlag)).toBe(false);
    });
  });
});
