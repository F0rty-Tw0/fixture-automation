import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { claudeModels } from './claude-models.client.ts';
import { scriptedConversation } from '../test/utils/agent-conversation.spec.util.ts';
import { agentArgs } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const controlResponse = (response: unknown): string => JSON.stringify({ type: 'control_response', response });
const catalog = (models: unknown): string => {
  const response = { models };

  return controlResponse({ subtype: 'success', request_id: 'models', response });
};

const discoverWith = async (lines: string[]): Promise<string[]> => {
  vi.mocked(runAgent).mockImplementation(scriptedConversation(lines, []));

  return claudeModels({ timeoutMs: 5_000 });
};

describe('FEATURE: Claude model discovery', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN Claude answers the initialize request with a model catalog', (): void => {
    it('WHEN discovering THEN returns the model values and closes the conversation', async (): Promise<void> => {
      const models = await discoverWith([catalog([{ value: 'model-a' }, { value: 'model-b' }])]);

      expect(models).toStrictEqual(['model-a', 'model-b']);
    });

    it('WHEN discovering THEN starts Claude in tool-less safe mode with an initialize request', async (): Promise<void> => {
      await discoverWith([catalog([{ value: 'model-a' }])]);

      const args = agentArgs(vi.mocked(runAgent).mock.calls);
      const [call] = vi.mocked(runAgent).mock.calls;

      expect(args).toContain('--safe-mode');
      expect(args).toContain('--no-session-persistence');
      expect(call?.[0].input).toBe(
        '{"type":"control_request","request_id":"models","request":{"subtype":"initialize","hooks":null}}\n'
      );
      expect(call?.[1].tool).toBe('claude');
    });
  });

  describe('GIVEN Claude emits other messages before the catalog', (): void => {
    it('WHEN a message is not a control response THEN keeps waiting', async (): Promise<void> => {
      const models = await discoverWith(['{"type":"system","subtype":"init"}', catalog([{ value: 'model-a' }])]);

      expect(models).toStrictEqual(['model-a']);
    });

    it('WHEN a control response answers another request THEN keeps waiting', async (): Promise<void> => {
      const other = controlResponse({ subtype: 'success', request_id: 'other', response: {} });

      const models = await discoverWith([other, catalog([{ value: 'model-a' }])]);

      expect(models).toStrictEqual(['model-a']);
    });
  });

  describe('GIVEN Claude sends a malformed protocol message', (): void => {
    it('WHEN the message is not an object THEN rejects it as an invalid control message', async (): Promise<void> => {
      await expect(discoverWith(['42'])).rejects.toThrow('Claude returned an invalid control message');
    });

    it('WHEN the control response is not an object THEN rejects it as an invalid control response', async (): Promise<void> => {
      await expect(discoverWith([controlResponse('done')])).rejects.toThrow('Claude returned an invalid control response');
    });

    it('WHEN the success response carries no result object THEN rejects the missing initialization result', async (): Promise<void> => {
      const noResult = controlResponse({ subtype: 'success', request_id: 'models', response: null });

      await expect(discoverWith([noResult])).rejects.toThrow('Claude returned no initialization result');
    });
  });

  describe('GIVEN Claude rejects the initialize request', (): void => {
    it('WHEN it names an error THEN rejects with that error', async (): Promise<void> => {
      const rejected = controlResponse({ subtype: 'error', request_id: 'models', error: 'Not logged in' });

      await expect(discoverWith([rejected])).rejects.toThrow('Not logged in');
    });

    it('WHEN it names no error THEN rejects with a generic discovery error', async (): Promise<void> => {
      const rejected = controlResponse({ subtype: 'error', request_id: 'models' });

      await expect(discoverWith([rejected])).rejects.toThrow('Claude rejected model discovery');
    });
  });

  describe('GIVEN Claude closes without answering', (): void => {
    it('WHEN discovering THEN rejects the incomplete exchange', async (): Promise<void> => {
      await expect(discoverWith([])).rejects.toThrow('Claude closed before returning its model catalog');
    });
  });
});
