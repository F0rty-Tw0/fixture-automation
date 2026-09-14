import { describe, expect, it } from 'vitest';

import { resolveAgentExecutable } from './agent-executable.client.ts';
import { processFixture } from '../test/utils/process-fixture.spec.util.ts';

describe('FEATURE: agent executable resolution', (): void => {
  describe('GIVEN a relative override', (): void => {
    it('WHEN resolving THEN rejects it with executable guidance', async (): Promise<void> => {
      await expect(resolveAgentExecutable('fixture-agent', 'fixture-agent')).rejects.toThrow(
        /absolute native executable or Node.js entry point/
      );
    });
  });

  describe('GIVEN a Windows command wrapper that is not a Node shim', (): void => {
    it.runIf(process.platform === 'win32')('WHEN resolving THEN rejects it without invoking a shell', async (): Promise<void> => {
      const wrapper = processFixture('executable-unknown-shim', 'fixture-agent.cmd');

      await expect(resolveAgentExecutable('fixture-agent', wrapper)).rejects.toThrow(/safely execute Windows command wrapper/);
    });
  });
});
