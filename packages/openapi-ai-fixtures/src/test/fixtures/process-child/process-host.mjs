import { fileURLToPath } from 'node:url';

import { runAgent } from '../../../data-access/agent-process.client.ts';

const executable = process.execPath;
const child = fileURLToPath(new URL('process-child.mjs', import.meta.url));
const command = {
  executable,
  args: [child, 'resistant-tree', ...process.argv.slice(2)],
  input: ''
};

try {
  await runAgent(command, { tool: 'claude', timeoutMs: 1_500 });
  process.exitCode = 1;
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes('timed out')) throw error;
}
