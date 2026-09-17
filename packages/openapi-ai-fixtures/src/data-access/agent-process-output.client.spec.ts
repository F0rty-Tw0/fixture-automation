import { describe, expect, it } from 'vitest';

import { agentOutputCollector } from './agent-process-output.client.ts';
import { runAgent } from './agent-process.client.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { childCommand } from '../test/utils/process-child.spec.util.ts';

const EIGHT_MEBIBYTES = 8 * 1024 * 1024;

describe('FEATURE: agent output collection', (): void => {
  describe('GIVEN text on both streams', (): void => {
    it('WHEN completing THEN returns each stream separately', (): void => {
      const collector = agentOutputCollector();

      collector.append(Buffer.from('out'), 'stdout');
      collector.append(Buffer.from('err'), 'stderr');

      const output = collector.complete();

      expect(output).toStrictEqual({ stderr: 'err', stdout: 'out' });
    });

    it('WHEN appending THEN returns the decoded chunk text', (): void => {
      const collector = agentOutputCollector();

      const text = collector.append(Buffer.from('chunk'), 'stdout');

      expect(text).toBe('chunk');
    });
  });

  describe('GIVEN a code point split across two chunks', (): void => {
    it('WHEN appending the first byte THEN returns no text until the code point completes', (): void => {
      const collector = agentOutputCollector();

      const first = collector.append(Buffer.from([0xc3]), 'stdout');
      const second = collector.append(Buffer.from([0xa9]), 'stdout');

      expect(first).toBe('');
      expect(second).toBe('é');
    });
  });

  describe('GIVEN chunks beyond the combined 8 MiB limit', (): void => {
    it('WHEN appending THEN throws instead of truncating', (): void => {
      const collector = agentOutputCollector();

      collector.append(Buffer.alloc(EIGHT_MEBIBYTES, 'x'), 'stdout');

      const overflow = (): string => collector.append(Buffer.from('x'), 'stderr');

      expect(overflow).toThrow('Agent output exceeds the 8 MiB limit');
    });
  });

  describe('GIVEN bytes that are not valid UTF-8', (): void => {
    it('WHEN appending THEN throws a decoding error', (): void => {
      const collector = agentOutputCollector();

      const append = (): string => collector.append(Buffer.from([0xff]), 'stdout');

      expect(append).toThrow('Agent output is not valid UTF-8');
    });

    it('WHEN completing with a dangling partial code point THEN throws a decoding error', (): void => {
      const collector = agentOutputCollector();

      collector.append(Buffer.from([0xc3]), 'stderr');

      const complete = (): unknown => collector.complete();

      expect(complete).toThrow('Agent output is not valid UTF-8');
    });
  });

  describe('GIVEN a child that exceeds the combined output limit', (): void => {
    it('WHEN running THEN rejects instead of truncating its output', async (): Promise<void> => {
      await expect(runAgent(childCommand('overflow', []), AI_FIXTURE_OPTIONS_STUB)).rejects.toThrow(/output exceeds the 8 MiB limit/);
    });
  });

  describe('GIVEN a child that splits a UTF-8 code point across writes', (): void => {
    it('WHEN progress is observed THEN delivers the original decoded text', async (): Promise<void> => {
      const progress: AiFixtureProgress[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        progress.push(event);
      };
      const options: AiFixtureOptions = { ...AI_FIXTURE_OPTIONS_STUB, onProgress };

      const output = await runAgent(childCommand('split-utf8', []), options);
      const stdoutEvents = progress.filter((event): boolean => event.stream === 'stdout');
      const stdout = stdoutEvents.map((event): string => event.text).join('');

      expect(output).toBe('{"name":"é"}');
      expect(stdout).toBe('{"name":"é"}');
    });
  });
});
