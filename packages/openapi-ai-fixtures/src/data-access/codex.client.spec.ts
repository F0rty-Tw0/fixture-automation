import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { codexFixture } from './codex.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'codex' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };

describe('FEATURE: Codex fixture response handling', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN Codex reports a failed turn in its zero-exit event stream', (): void => {
    it('WHEN the fixture is requested THEN rejects the reported error', async (): Promise<void> => {
      const error = { message: 'Authentication failed.' };
      const response = JSON.stringify({
        type: 'turn.failed',
        error
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = codexFixture(request);

      await expect(fixture).rejects.toThrow('Authentication failed.');
    });
  });

  describe('GIVEN Codex completes a turn with malformed fixture text', (): void => {
    it('WHEN the fixture is requested THEN returns the exact response for central parsing', async (): Promise<void> => {
      const text = '{not-json}';
      const message = { type: 'agent_message', text };
      const events = [JSON.stringify({ type: 'item.completed', item: message }), JSON.stringify({ type: 'turn.completed' })];
      const response = events.join('\n');

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await codexFixture(request);

      expect(fixture).toBe(text);
    });
  });

  describe('GIVEN Codex completes a turn with a fixture message', (): void => {
    it('WHEN the fixture is requested THEN returns the exact fixture text', async (): Promise<void> => {
      const expected = { id: 'invoice-1', amount: 42 };
      const text = JSON.stringify(expected);
      const message = { type: 'agent_message', text };
      const events = [JSON.stringify({ type: 'item.completed', item: message }), JSON.stringify({ type: 'turn.completed' })];
      const response = events.join('\n');

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await codexFixture(request);

      expect(fixture).toBe(text);
    });
  });
});
