import { describe, expect, it } from 'vitest';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentRespond } from '../common/agent.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { nodeScriptCommand } from '../test/utils/process-child.spec.util.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

const CONVERSATION = processFixture('process-child', 'conversation.mjs');
const ONE_MEBIBYTE = 1024 * 1024;
const ECHO_STDIN = "let input = ''; process.stdin.on('data', (c) => (input += c)).on('end', () => process.stdout.write(input));";
const TWO_LINES = "console.log('ready'); console.log('later');";

const conversation = (respond: AgentRespond): AgentCommand => {
  const command: AgentCommand = { executable: process.execPath, args: [CONVERSATION], input: 'initialize\n', respond };

  return command;
};

describe('FEATURE: agent process input piping', (): void => {
  describe('GIVEN no responder', (): void => {
    it('WHEN running THEN writes the whole input and closes stdin', async (): Promise<void> => {
      const output = await runAgent(nodeScriptCommand(ECHO_STDIN, 'line one\nline two'), AI_FIXTURE_OPTIONS_STUB);

      expect(output).toBe('line one\nline two');
    });
  });

  describe('GIVEN a provider that requires a response before listing models', (): void => {
    it('WHEN exchanging split lines THEN waits for the catalog before closing stdin', async (): Promise<void> => {
      const respond = (line: string): string | null | undefined => {
        if (line === 'ready') return 'models\n';

        if (line === 'model-from-provider') return null;

        return undefined;
      };

      const output = await runAgent(conversation(respond), AI_FIXTURE_OPTIONS_STUB);

      expect(output).toBe('ready\nnotification\nmodel-from-provider\n');
    });
  });

  describe('GIVEN a completed conversation', (): void => {
    it('WHEN more lines arrive THEN the responder is not asked again', async (): Promise<void> => {
      const respond = (line: string): string | null => {
        if (line === 'ready') return null;

        throw new Error(`unexpected line: ${line}`);
      };
      const twoLines = nodeScriptCommand(TWO_LINES, 'initialize\n');
      const command: AgentCommand = { ...twoLines, respond };

      const output = await runAgent(command, AI_FIXTURE_OPTIONS_STUB);

      expect(output).toBe('ready\nlater\n');
    });
  });

  describe('GIVEN a reply that pushes the conversation past the input limit', (): void => {
    it('WHEN replying THEN rejects with the 1 MiB limit', async (): Promise<void> => {
      const respond = (): string => 'x'.repeat(ONE_MEBIBYTE);

      const execution = runAgent(conversation(respond), AI_FIXTURE_OPTIONS_STUB);

      await expect(execution).rejects.toThrow('Agent input exceeds the 1 MiB limit');
    });
  });

  describe('GIVEN a responder that throws', (): void => {
    it('WHEN it throws an Error THEN rejects with that error', async (): Promise<void> => {
      const failure = new Error('responder failure');
      const respond = (): string => {
        throw failure;
      };

      const execution = runAgent(conversation(respond), AI_FIXTURE_OPTIONS_STUB);

      await expect(execution).rejects.toBe(failure);
    });

    it('WHEN it throws a non-Error value THEN rejects with a conversation failure carrying it', async (): Promise<void> => {
      const cause: unknown = 'responder failure';
      const respond = (): string => {
        throw cause;
      };

      const execution = runAgent(conversation(respond), AI_FIXTURE_OPTIONS_STUB);

      await expect(execution).rejects.toStrictEqual(new Error('Agent conversation failed', { cause: 'responder failure' }));
    });
  });
});
