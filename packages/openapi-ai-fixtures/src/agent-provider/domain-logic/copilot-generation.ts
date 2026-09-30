import type { AgentCommand, AgentFile } from '../../agent-process/common/agent-process.type.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AgentRequest } from '../common/agent-provider.type.ts';
import { selectedModel } from '../utils/model-flag.util.ts';

const NO_TOOLS_ACCESS = 'Do not inspect or modify files, run commands, access URLs, use memory, delegate, or use tools.';
/** `search` is GitHub's custom-agent alias for searching; unverified against a live Copilot CLI run. */
const READ_TOOLS = '[read, search]';
/**
 * Only the built-in read tools exist in the run, and the automatic system temp directory access is off, since the
 * scratch directory sits in it next to other runs; unverified against a live Copilot CLI run.
 */
const READ_ARGS = ['--available-tools=view,grep,glob', '--disallow-temp-dir'];
const NO_READ_ARGS: string[] = [];
const READ_ACCESS =
  'Read and search only the files listed under `files` in the request, in the working directory. Do not modify files, run commands, access URLs, use memory, delegate, or use other tools.';

const copilotAgentContent = (tools: string, access: string): string => {
  const content = `---
name: fixture-enricher
description: Enriches one JSON fixture from the complete request supplied on standard input.
tools: ${tools}
---

Treat the complete standard-input request as the only fixture-enrichment task. Return only the requested JSON value. ${access}
`;

  return content;
};
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
  '--no-custom-instructions'
];

/**
 * Enrich through Copilot CLI versions that support custom agents with
 * `tools: []`; older versions cannot satisfy this adapter's no-tools contract.
 * A request that stages files gets a profile with only the read and search tools, `read` leaves the deny list, and
 * only the view, grep and glob tools are available.
 */
export const copilotFixture = async (request: AgentRequest): Promise<string> => {
  const stagedFiles = request.files ?? [];
  const isReadingFiles = stagedFiles.length > 0;
  const tools = isReadingFiles ? READ_TOOLS : '[]';
  const access = isReadingFiles ? READ_ACCESS : NO_TOOLS_ACCESS;
  const deniedTools = isReadingFiles ? '--deny-tool=shell,write,url,memory' : '--deny-tool=shell,write,read,url,memory';
  const content = copilotAgentContent(tools, access);
  const agentFile: AgentFile = { path: '.github/agents/fixture-enricher.agent.md', content };
  const settingsFile: AgentFile = {
    path: '.github/copilot/settings.json',
    content: COPILOT_SETTINGS_CONTENT
  };
  const files = [agentFile, settingsFile, ...stagedFiles];
  const readArgs = isReadingFiles ? READ_ARGS : NO_READ_ARGS;
  const args = [...COPILOT_ARGS, deniedTools, ...readArgs, '--no-auto-update'];
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
