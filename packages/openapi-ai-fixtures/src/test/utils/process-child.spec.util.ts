import { processFixture } from './process-fixture.spec.util.ts';
import type { AgentCommand } from '../../common/agent.type.ts';

const PROCESS_CHILD = processFixture('process-child', 'process-child.mjs');

/** Starts the process-child fixture in `mode` through the current Node executable. */
export const childCommand = (mode: string, args: string[], input = ''): AgentCommand => {
  const command: AgentCommand = {
    executable: process.execPath,
    args: [PROCESS_CHILD, mode, ...args],
    input
  };

  return command;
};

/** Runs an inline script through the current Node executable, so a case needs no fixture file. */
export const nodeScriptCommand = (script: string, input = ''): AgentCommand => {
  const command: AgentCommand = { executable: process.execPath, args: ['-e', script], input };

  return command;
};
