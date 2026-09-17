import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { codexModels } from './codex-models.client.ts';
import { scriptedConversation } from '../test/utils/agent-conversation.spec.util.ts';
import { agentArgs } from '../test/utils/agent-model.spec.util.ts';

vi.mock('./agent-process.client.ts');

const INITIALIZE_RESULT = { userAgent: 'fixture' };
const INITIALIZED = JSON.stringify({ id: 0, result: INITIALIZE_RESULT });
const NOTIFICATION = '{"method":"notification"}';

const page = (id: number, models: string[], nextCursor: unknown): string => {
  const entry = (model: string): Record<string, string> => {
    const modelEntry = { model };

    return modelEntry;
  };
  const data = models.map(entry);
  const result = { data, nextCursor };

  return JSON.stringify({ id, result });
};

const discoverWith = async (lines: string[], replies: string[] = []): Promise<string[]> => {
  vi.mocked(runAgent).mockImplementation(scriptedConversation(lines, replies));

  return codexModels({ timeoutMs: 5_000 });
};

describe('FEATURE: Codex model discovery', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN an app server that answers initialize and one model page', (): void => {
    it('WHEN discovering THEN returns the page models', async (): Promise<void> => {
      const models = await discoverWith([INITIALIZED, page(1, ['model-a', 'model-b'], null)]);

      expect(models).toStrictEqual(['model-a', 'model-b']);
    });

    it('WHEN initialized THEN acknowledges and requests the visible models', async (): Promise<void> => {
      const replies: string[] = [];

      await discoverWith([INITIALIZED, page(1, ['model-a'], null)], replies);

      expect(replies).toStrictEqual([
        '{"method":"initialized","params":{}}\n{"jsonrpc":"2.0","id":1,"method":"model/list","params":{"includeHidden":false}}\n'
      ]);
    });

    it('WHEN discovering THEN starts the Codex app server with an initialize request', async (): Promise<void> => {
      await discoverWith([INITIALIZED, page(1, ['model-a'], null)]);

      const [call] = vi.mocked(runAgent).mock.calls;

      expect(agentArgs(vi.mocked(runAgent).mock.calls)).toStrictEqual(['app-server']);
      expect(call?.[0].input).toBe(
        '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"clientInfo":{"name":"fixture_automation","version":"0.0.1"}}}\n'
      );
      expect(call?.[1].tool).toBe('codex');
    });
  });

  describe('GIVEN a catalog spanning two pages', (): void => {
    it('WHEN a page names a cursor THEN requests the next page with it', async (): Promise<void> => {
      const replies: string[] = [];

      await discoverWith([INITIALIZED, page(1, ['model-a'], 'page-two'), page(2, ['model-b'], undefined)], replies);

      expect(replies.at(-1)).toBe(
        '{"jsonrpc":"2.0","id":2,"method":"model/list","params":{"includeHidden":false,"cursor":"page-two"}}\n'
      );
    });

    it('WHEN the last page omits its cursor THEN returns every model once', async (): Promise<void> => {
      const models = await discoverWith([INITIALIZED, page(1, ['model-a'], 'page-two'), page(2, ['model-b', 'model-a'], undefined)]);

      expect(models).toStrictEqual(['model-a', 'model-b']);
    });
  });

  describe('GIVEN notifications interleaved with responses', (): void => {
    it('WHEN a line answers no pending request THEN keeps waiting', async (): Promise<void> => {
      const models = await discoverWith([NOTIFICATION, INITIALIZED, NOTIFICATION, page(1, ['model-a'], null)]);

      expect(models).toStrictEqual(['model-a']);
    });
  });

  describe('GIVEN an invalid page cursor', (): void => {
    it('WHEN the cursor is not a string THEN rejects it', async (): Promise<void> => {
      await expect(discoverWith([INITIALIZED, page(1, ['model-a'], 7)])).rejects.toThrow('Codex returned an invalid model cursor');
    });

    it('WHEN the cursor is empty THEN rejects it', async (): Promise<void> => {
      await expect(discoverWith([INITIALIZED, page(1, ['model-a'], '')])).rejects.toThrow('Codex returned an invalid model cursor');
    });

    it('WHEN a cursor repeats THEN rejects the loop', async (): Promise<void> => {
      const lines = [INITIALIZED, page(1, ['model-a'], 'page-two'), page(2, ['model-b'], 'page-two')];

      await expect(discoverWith(lines)).rejects.toThrow('Codex repeated a model cursor');
    });
  });

  describe('GIVEN the app server closes before the catalog completes', (): void => {
    it('WHEN discovering THEN rejects the incomplete exchange', async (): Promise<void> => {
      await expect(discoverWith([INITIALIZED])).rejects.toThrow('Codex closed before returning its model catalog');
    });
  });
});
