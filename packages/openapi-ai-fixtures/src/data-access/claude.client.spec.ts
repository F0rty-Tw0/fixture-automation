import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { claudeFixture } from './claude.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'claude' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };

describe('FEATURE: Claude fixture response handling', (): void => {
  beforeEach((): void => {
    vi.mocked(runAgent).mockReset();
  });

  describe('GIVEN Claude reports an error in a zero-exit result envelope', (): void => {
    it('WHEN the fixture is requested THEN rejects the reported error', async (): Promise<void> => {
      const response = JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
        result: 'Authentication failed.'
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = claudeFixture(request);

      await expect(fixture).rejects.toThrow('Authentication failed.');
    });
  });

  describe('GIVEN Claude reports success with malformed final fixture JSON', (): void => {
    it('WHEN the fixture is requested THEN rejects the malformed result', async (): Promise<void> => {
      const response = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: '{not-json}'
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = claudeFixture(request);

      await expect(fixture).rejects.toThrow('claude returned invalid JSON');
    });
  });

  describe('GIVEN Claude reports success with a JSON fixture result', (): void => {
    it('WHEN the fixture is requested THEN returns the parsed fixture', async (): Promise<void> => {
      const expected = { id: 'invoice-1', amount: 42 };
      const response = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: JSON.stringify(expected)
      });

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await claudeFixture(request);

      expect(fixture).toStrictEqual(expected);
    });
  });
});
