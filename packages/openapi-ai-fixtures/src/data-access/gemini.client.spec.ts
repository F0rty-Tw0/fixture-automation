import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import { geminiFixture } from './gemini.client.ts';
import type { AgentRequest } from '../common/agent.type.ts';

vi.mock('./agent-process.client.ts');

const options = { tool: 'gemini' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };

describe('FEATURE: Gemini fixture response handling', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN Gemini returns a successful JSON envelope', (): void => {
    it('WHEN the fixture is requested THEN returns the parsed response JSON', async (): Promise<void> => {
      const envelope = { response: '{"id":"fixture-1"}', stats: {} };
      const response = JSON.stringify(envelope);

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await geminiFixture(request);

      expect(fixture).toStrictEqual({ id: 'fixture-1' });
    });
  });

  describe('GIVEN Gemini returns an error envelope', (): void => {
    it('WHEN the fixture is requested THEN rejects the response', async (): Promise<void> => {
      const error = { message: 'Authentication failed.' };
      const envelope = { error, response: '{"id":"fixture-1"}' };
      const response = JSON.stringify(envelope);

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('Gemini CLI reported a failed response.');
    });
  });

  describe('GIVEN Gemini returns a malformed transport envelope', (): void => {
    it('WHEN the fixture is requested THEN rejects the response', async (): Promise<void> => {
      const response = '[]';

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('gemini returned an invalid response envelope');
    });
  });

  describe('GIVEN Gemini returns an envelope without a response string', (): void => {
    it('WHEN the fixture is requested THEN rejects the unsupported envelope', async (): Promise<void> => {
      const response = '{"stats":{}}';

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('Gemini CLI returned an unsupported JSON envelope without a response string.');
    });
  });

  describe('GIVEN Gemini returns malformed fixture JSON in a successful envelope', (): void => {
    it('WHEN the fixture is requested THEN rejects instead of scraping the response', async (): Promise<void> => {
      const envelope = { response: '```json\n{"id":"fixture-1"}\n```' };
      const response = JSON.stringify(envelope);

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('gemini returned invalid JSON');
    });
  });
});
