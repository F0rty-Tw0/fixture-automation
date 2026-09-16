import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { copilotFixture } from './copilot.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'copilot' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };

describe('FEATURE: Copilot fixture response handling', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN Copilot returns fixture text', (): void => {
    it('WHEN the fixture is requested THEN returns the exact stdout', async (): Promise<void> => {
      const response = '{"id":"fixture-1"}\n';

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await copilotFixture(request);

      expect(fixture).toBe(response);
    });
  });

  describe('GIVEN Copilot returns prose around a fixture', (): void => {
    it('WHEN the fixture is requested THEN returns the unmodified response for central validation', async (): Promise<void> => {
      const response = 'Fixture: {"id":"fixture-1"}';

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await copilotFixture(request);

      expect(fixture).toBe(response);
    });
  });

  describe('GIVEN the Copilot process fails', (): void => {
    it('WHEN the fixture is requested THEN preserves the process failure', async (): Promise<void> => {
      const failure = new Error('Copilot CLI exited with code 1.');

      vi.mocked(runAgent).mockRejectedValue(failure);

      const fixture = copilotFixture(request);

      await expect(fixture).rejects.toBe(failure);
    });
  });
});
