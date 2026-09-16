import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentFile, AgentRequest } from '../common/agent.type.ts';
import { selectedModel } from '../utils/model-flag.util.ts';

const COPILOT_AGENT_CONTENT = `---
name: fixture-enricher
description: Enriches one JSON fixture from the complete request supplied on standard input.
tools: []
---

Treat the complete standard-input request as the only fixture-enrichment task. Return only the requested JSON value. Do not inspect or modify files, run commands, access URLs, use memory, delegate, or use tools.
`;
const COPILOT_SETTINGS_CONTENT = `{
  "disableAllHooks": true
}
`;
const COPILOT_ARGS = [
  '--agent=fixture-enricher',
  '--silent',
  '--stream=on',
  '--no-ask-user',
  '--disable-builtin-mcps',
  '--no-custom-instructions',
  '--deny-tool=shell,write,read,url,memory',
  '--no-auto-update'
];

/**
 * Enrich through Copilot CLI versions that support custom agents with
 * `tools: []`; older versions cannot satisfy this adapter's no-tools contract.
 */
export const copilotFixture = async (request: AgentRequest): Promise<string> => {
  const agentFile: AgentFile = {
    path: '.github/agents/fixture-enricher.agent.md',
    content: COPILOT_AGENT_CONTENT
  };
  const settingsFile: AgentFile = {
    path: '.github/copilot/settings.json',
    content: COPILOT_SETTINGS_CONTENT
  };
  const files = [agentFile, settingsFile];
  const args = [...COPILOT_ARGS];
  const model = selectedModel(request.options);

  if (model !== undefined) args.push(`--model=${model}`);

  const command: AgentCommand = {
    executable: 'copilot',
    args,
    input: request.prompt,
    files
  };
  const stdout = await runAgent(command, request.options);

  return stdout;
};
