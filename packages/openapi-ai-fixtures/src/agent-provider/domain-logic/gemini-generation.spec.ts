import { beforeEach, describe, expect, it, vi } from 'vitest';

import { geminiFixture } from './gemini-generation.ts';
import type { AgentCommand, AgentFile } from '../../agent-process/common/agent-process.type.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { agentArgs, modelRequest } from '../../test/utils/agent-model.spec.util.ts';
import { agentResponse } from '../../test/utils/agent-response.spec.util.ts';
import type { AgentRequest } from '../common/agent-provider.type.ts';
import { GEMINI_EXCLUDED_TOOLS } from '../common/gemini.const.ts';

vi.mock('../../agent-process/data-access/agent-process.client.ts');

const options = { tool: 'gemini' } as const;
const request: AgentRequest = { prompt: 'Return a fixture.', options };
const geminiEnvelope = agentResponse('gemini', '{}');
const EXCLUDED_TOOLS = { exclude: GEMINI_EXCLUDED_TOOLS, discoveryCommand: '' };

const onlyCommand = (calls: (readonly [AgentCommand, AiFixtureOptions])[]): AgentCommand => {
  const [call] = calls;

  if (call === undefined) throw new Error('runAgent was not called');

  return call[0];
};

const writtenSettings = (calls: (readonly [AgentCommand, AiFixtureOptions])[]): unknown => {
  const files = onlyCommand(calls).files ?? [];
  const settingsFile = files.find((file: AgentFile): boolean => file.path === '.gemini/system-settings.json');

  if (settingsFile === undefined) throw new Error('no Gemini system settings file was written');

  return JSON.parse(settingsFile.content);
};

describe('FEATURE: Gemini fixture response handling', (): void => {
  beforeEach((): void => {
    vi.resetAllMocks();
  });

  describe('GIVEN Gemini emits assistant text before a successful terminal result', (): void => {
    it('WHEN the fixture is requested THEN returns the exact concatenated assistant text', async (): Promise<void> => {
      const firstText = '{"id":';
      const secondText = '"fixture-1"}';
      const init = JSON.stringify({
        model: 'gemini-test',
        session_id: 'session-1',
        timestamp: '2026-09-16T00:00:00.000Z',
        type: 'init'
      });
      const firstMessage = JSON.stringify({
        content: firstText,
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'message'
      });
      const secondMessage = JSON.stringify({
        content: secondText,
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:02.000Z',
        type: 'message'
      });
      const result = JSON.stringify({
        stats: {},
        status: 'success',
        timestamp: '2026-09-16T00:00:03.000Z',
        type: 'result'
      });
      const response = `${init}\n${firstMessage}\n${secondMessage}\n${result}\n`;

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await geminiFixture(request);

      expect(fixture).toBe(`${firstText}${secondText}`);
    });
  });

  describe('GIVEN Gemini reports a failed terminal result after assistant text', (): void => {
    it('WHEN the fixture is requested THEN rejects instead of returning partial text', async (): Promise<void> => {
      const init = JSON.stringify({
        model: 'gemini-test',
        session_id: 'session-1',
        timestamp: '2026-09-16T00:00:00.000Z',
        type: 'init'
      });
      const message = JSON.stringify({
        content: '{"id":"partial"}',
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'message'
      });
      const result = JSON.stringify({
        stats: {},
        status: 'error',
        timestamp: '2026-09-16T00:00:02.000Z',
        type: 'result'
      });
      const response = `${init}\n${message}\n${result}\n`;

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('Gemini CLI reported a failed stream result.');
    });
  });

  describe('GIVEN Gemini emits no terminal result', (): void => {
    it('WHEN the fixture is requested THEN rejects the truncated stream', async (): Promise<void> => {
      const init = JSON.stringify({
        model: 'gemini-test',
        session_id: 'session-1',
        timestamp: '2026-09-16T00:00:00.000Z',
        type: 'init'
      });
      const message = JSON.stringify({
        content: '{"id":"fixture-1"}',
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'message'
      });
      const response = `${init}\n${message}\n`;

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = geminiFixture(request);

      await expect(fixture).rejects.toThrow('Gemini CLI stream ended without a terminal result.');
    });
  });

  describe('GIVEN Gemini output is split across progress chunks', (): void => {
    it('WHEN the fixture is requested THEN reports readable activity without forwarding user prompts or tool arguments', async (): Promise<void> => {
      const init = JSON.stringify({
        model: 'gemini-test',
        session_id: 'session-1',
        timestamp: '2026-09-16T00:00:00.000Z',
        type: 'init'
      });
      const userMessage = JSON.stringify({
        content: 'Do not echo this prompt.',
        role: 'user',
        timestamp: '2026-09-16T00:00:01.000Z',
        type: 'message'
      });
      const parameters = { secret: 'Do not echo this argument.' };
      const toolUse = JSON.stringify({
        parameters,
        timestamp: '2026-09-16T00:00:02.000Z',
        tool_id: 'tool-1',
        tool_name: 'read_file',
        type: 'tool_use'
      });
      const assistantMessage = JSON.stringify({
        content: '{"id":"fixture-1"}',
        delta: true,
        role: 'assistant',
        timestamp: '2026-09-16T00:00:03.000Z',
        type: 'message'
      });
      const warning = JSON.stringify({
        message: 'Model is nearing its context limit.',
        severity: 'warning',
        timestamp: '2026-09-16T00:00:04.000Z',
        type: 'error'
      });
      const result = JSON.stringify({
        stats: {},
        status: 'success',
        timestamp: '2026-09-16T00:00:05.000Z',
        type: 'result'
      });
      const response = `${init}\n${userMessage}\n${toolUse}\n${assistantMessage}\n${warning}\n${result}\n`;
      const progress: AiFixtureProgress[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        progress.push(event);
      };
      const optionsWithProgress = { ...options, onProgress };
      const requestWithProgress: AgentRequest = { ...request, options: optionsWithProgress };
      const splitAt = assistantMessage.length / 2;
      const firstChunk = `${init}\n${userMessage}\n${toolUse}\n${assistantMessage.slice(0, splitAt)}`;
      const secondChunk = `${assistantMessage.slice(splitAt)}\n${warning}\n`;

      vi.mocked(runAgent).mockImplementation(async (_command, runOptions): Promise<string> => {
        const report = runOptions.onProgress;

        if (report !== undefined) {
          report({ stream: 'status', text: 'gemini started\n' });
          report({ stream: 'stdout', text: firstChunk });
          report({ stream: 'stdout', text: secondChunk });
          report({ stream: 'stderr', text: 'provider diagnostic\n' });
        }

        const output = await Promise.resolve(response);

        return output;
      });

      const fixture = await geminiFixture(requestWithProgress);

      expect(fixture).toBe('{"id":"fixture-1"}');
      expect(progress).toStrictEqual([
        { stream: 'status', text: 'gemini started\n' },
        { stream: 'status', text: 'Gemini session initialized with gemini-test.\n' },
        { stream: 'stdout', text: '{"id":"fixture-1"}' },
        { stream: 'status', text: 'Gemini warning: Model is nearing its context limit.\n' },
        { stream: 'stderr', text: 'provider diagnostic\n' }
      ]);
    });
  });

  describe('GIVEN Gemini returns malformed fixture text in a successful stream', (): void => {
    it('WHEN the fixture is requested THEN returns the exact text for central validation', async (): Promise<void> => {
      const fixtureText = '```json\n{"id":"fixture-1"}\n```';
      const response = agentResponse('gemini', fixtureText);

      vi.mocked(runAgent).mockResolvedValue(response);

      const fixture = await geminiFixture(request);

      expect(fixture).toBe(fixtureText);
    });
  });

  describe('GIVEN any fixture request', (): void => {
    it('WHEN the command is built THEN its system settings exclude every built-in tool and discover none', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

      await geminiFixture(request);

      expect(writtenSettings(vi.mocked(runAgent).mock.calls)).toHaveProperty('tools', EXCLUDED_TOOLS);
    });

    it('WHEN the command is built THEN update_topic stays declared so the request never carries an empty tool entry', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

      await geminiFixture(request);

      const settings = writtenSettings(vi.mocked(runAgent).mock.calls);

      expect(GEMINI_EXCLUDED_TOOLS).not.toContain('update_topic');
      expect(settings).toHaveProperty('general.topicUpdateNarration', true);
    });

    it.each(['read_file', 'write_file', 'replace', 'run_shell_command', 'web_fetch', 'google_web_search', 'invoke_agent'])(
      'WHEN the command is built THEN %s is excluded',
      async (tool: string): Promise<void> => {
        vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

        await geminiFixture(request);

        expect(writtenSettings(vi.mocked(runAgent).mock.calls)).toHaveProperty('tools.exclude', expect.arrayContaining([tool]));
      }
    );

    it('WHEN the command is built THEN no core allowlist is written, since an empty one makes the API answer 400', async (): Promise<void> => {
      vi.mocked(runAgent).mockResolvedValue(geminiEnvelope);

      await geminiFixture(request);

      expect(writtenSettings(vi.mocked(runAgent).mock.calls)).not.toHaveProperty('tools.core');
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
});
