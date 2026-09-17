import { access, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { AgentProcessExecution } from './agent-process-execution.client.ts';
import { runAgent } from './agent-process.client.ts';
import type { AiFixtureOptions, AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { AI_FIXTURE_OPTIONS_STUB } from '../test/stubs/ai-fixture-options.stub.ts';
import { childCommand } from '../test/utils/process-child.spec.util.ts';
import { processWorkspace } from '../test/utils/process-workspace.spec.util.ts';

type ProgressListener = (progress: AiFixtureProgress) => void;

const EIGHT_MEBIBYTES = 8 * 1024 * 1024;

const ignoreTerminationFailure = (): void => undefined;
const ignoreOutput = (): void => undefined;
const execution = (onProgress: ProgressListener | undefined, onOutput = ignoreOutput): AgentProcessExecution => {
  return new AgentProcessExecution(undefined, ignoreTerminationFailure, onOutput, onProgress);
};

describe('FEATURE: agent process execution state', (): void => {
  describe('GIVEN no progress listener', (): void => {
    it('WHEN reporting status THEN returns no error', (): void => {
      const agent = execution(undefined);

      const error = agent.reportStatus('Started.\n');

      expect(error).toBeUndefined();
    });

    it('WHEN receiving output THEN keeps it for the result without noting activity', async (): Promise<void> => {
      let outputNotes = 0;
      const noteOutput = (): void => {
        outputNotes += 1;
      };
      const agent = execution(undefined, noteOutput);

      agent.receiveOutput(Buffer.from('out'), 'stdout');

      const output = await agent.result('agent', 0, null);

      expect(output).toBe('out');
      expect(outputNotes).toBe(0);
    });
  });

  describe('GIVEN a progress listener that throws a non-Error value', (): void => {
    it('WHEN reporting status THEN returns an error carrying the thrown value as cause', (): void => {
      const cause: unknown = 'listener failure';
      const onProgress = (): void => {
        throw cause;
      };
      const agent = execution(onProgress);

      const error = agent.reportStatus('Started.\n');

      expect(error).toStrictEqual(new Error('Agent progress listener failed', { cause: 'listener failure' }));
    });
  });

  describe('GIVEN a progress listener', (): void => {
    it('WHEN an empty decoded chunk arrives THEN notes activity without reporting progress', async (): Promise<void> => {
      const events: AiFixtureProgress[] = [];
      let outputNotes = 0;
      const onProgress = (event: AiFixtureProgress): void => {
        events.push(event);
      };
      const noteOutput = (): void => {
        outputNotes += 1;
      };
      const agent = execution(onProgress, noteOutput);

      agent.receiveOutput(Buffer.from([0xc3]), 'stdout');
      agent.receiveOutput(Buffer.from([0xa9]), 'stdout');

      await expect(agent.result('agent', 0, null)).resolves.toBe('é');
      expect(events).toStrictEqual([{ stream: 'stdout', text: 'é' }]);
      expect(outputNotes).toBe(2);
    });

    it('WHEN the listener throws on output THEN the result rejects with the listener error', async (): Promise<void> => {
      const failure = new Error('progress listener failure');
      const onProgress = (): void => {
        throw failure;
      };
      const agent = execution(onProgress);

      agent.receiveOutput(Buffer.from('out'), 'stdout');

      await expect(agent.result('agent', 0, null)).rejects.toBe(failure);
    });
  });

  describe('GIVEN output the collector rejects', (): void => {
    it('WHEN receiving it THEN the result rejects with the collector error', async (): Promise<void> => {
      const agent = execution(undefined);

      agent.receiveOutput(Buffer.alloc(EIGHT_MEBIBYTES + 1, 'x'), 'stdout');

      await expect(agent.result('agent', 0, null)).rejects.toThrow('Agent output exceeds the 8 MiB limit');
    });
  });

  describe('GIVEN a stopped execution', (): void => {
    it('WHEN stopped again THEN keeps the first failure', async (): Promise<void> => {
      const first = new Error('first failure');
      const agent = execution(undefined);

      agent.stop(first);
      agent.stop(new Error('second failure'));

      await expect(agent.result('agent', 0, null)).rejects.toBe(first);
    });

    it('WHEN output arrives THEN ignores it', async (): Promise<void> => {
      const events: AiFixtureProgress[] = [];
      const onProgress = (event: AiFixtureProgress): void => {
        events.push(event);
      };
      const agent = execution(onProgress);

      agent.stop(new Error('stopped'));
      agent.receiveOutput(Buffer.from('late'), 'stdout');

      await expect(agent.result('agent', 0, null)).rejects.toThrow('stopped');
      expect(events).toStrictEqual([]);
    });
  });

  describe('GIVEN a child that exited without a failure', (): void => {
    it('WHEN it exited by signal THEN reports the signal', async (): Promise<void> => {
      const agent = execution(undefined);

      const result = agent.result('agent', null, 'SIGKILL');

      await expect(result).rejects.toThrow('Agent "agent" exited with signal SIGKILL');
    });

    it('WHEN neither code nor signal is known THEN reports an unknown signal', async (): Promise<void> => {
      const agent = execution(undefined);

      const result = agent.result('agent', null, null);

      await expect(result).rejects.toThrow('Agent "agent" exited with signal unknown');
    });

    it('WHEN it exited with a code and no stderr THEN reports only the code', async (): Promise<void> => {
      const agent = execution(undefined);

      const result = agent.result('agent', 3, null);

      await expect(result).rejects.toThrow('Agent "agent" exited with code 3');
    });
  });

  describe('GIVEN a child that writes output before it exits', (): void => {
    it('WHEN progress is observed THEN delivers decoded streams before settlement', async (): Promise<void> => {
      const { promise: outputObserved, resolve: resolveOutputObserved } = Promise.withResolvers<undefined>();
      const progress: AiFixtureProgress[] = [];
      let isComplete = false;
      const onProgress = (event: AiFixtureProgress): void => {
        progress.push(event);

        const containsFirstOutput = event.text.includes('first');
        const isFirstStdout = event.stream === 'stdout' && containsFirstOutput;

        if (isFirstStdout) resolveOutputObserved(undefined);
      };
      const options: AiFixtureOptions = { tool: 'claude', onProgress };
      const running = runAgent(childCommand('stream', []), options).finally((): void => {
        isComplete = true;
      });

      await outputObserved;

      expect(isComplete).toBe(false);

      const output = await running;

      expect(output).toBe('firstcomplete');
      expect(progress).toContainEqual({ stream: 'stderr', text: 'warning' });
    });
  });

  describe('GIVEN a child that exits unsuccessfully', (): void => {
    it('WHEN running THEN reports its exit code and stderr after scratch cleanup', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');

      try {
        await expect(runAgent(childCommand('nonzero', [marker]), AI_FIXTURE_OPTIONS_STUB)).rejects.toThrow(
          /exited with code 23.*fixture child failed/
        );

        const cwd = await readFile(marker, 'utf8');

        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });

  describe('GIVEN a progress listener that fails on child output', (): void => {
    it('WHEN the child writes its working directory THEN rejects and cleans the scratch directory', async (): Promise<void> => {
      const workspace = await processWorkspace();
      const marker = workspace.file('child-cwd.txt');
      const onProgress = (event: AiFixtureProgress): void => {
        if (event.stream === 'stdout') throw new Error('progress listener failure');
      };
      const options: AiFixtureOptions = { tool: 'claude', onProgress };
      const running = runAgent(childCommand('progress-wait', [marker]), options);

      try {
        const cwd = await workspace.waitForFile('child-cwd.txt');

        await expect(running).rejects.toThrow(/progress listener failure/);
        await expect(access(cwd)).rejects.toThrow();
      } finally {
        await workspace.dispose();
      }
    });
  });
});
