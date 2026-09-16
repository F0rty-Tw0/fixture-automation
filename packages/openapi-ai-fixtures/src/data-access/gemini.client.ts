import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentFile, AgentRequest } from '../common/agent.type.ts';
import { parseAgentEnvelope } from '../utils/agent-response.util.ts';
import { selectedModel } from '../utils/model-flag.util.ts';

const GEMINI_PROMPT = 'Process the fixture-enrichment request supplied on standard input. Return only its requested JSON value.';
const GEMINI_SETTINGS_CONTENT = `{
  "general": {
    "enableAutoUpdate": false
  },
  "ide": {
    "enabled": false,
    "hasSeenNudge": true
  },
  "skills": {
    "enabled": false
  },
  "hooksConfig": {
    "enabled": false
  },
  "admin": {
    "mcp": {
      "enabled": false
    }
  }
}
`;
const GEMINI_ARGS = ['--prompt', GEMINI_PROMPT, '--output-format', 'json', '--approval-mode', 'default', '--extensions', 'none'];

/**
 * Enrich through Gemini CLI versions supporting headless JSON envelopes,
 * `--extensions none`, and system settings paths.
 */
export const geminiFixture = async (request: AgentRequest): Promise<string> => {
  const settingsFile: AgentFile = {
    path: '.gemini/system-settings.json',
    content: GEMINI_SETTINGS_CONTENT
  };
  const files = [settingsFile];
  const args = [...GEMINI_ARGS];
  const model = selectedModel(request.options);

  if (model !== undefined) args.push('-m', model);

  const env: Record<string, string | undefined> = {};

  env['GEMINI_CLI_IDE_AUTH_TOKEN'] = undefined;
  env['GEMINI_CLI_IDE_PID'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_PORT'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_STDIO_ARGS'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_STDIO_COMMAND'] = undefined;
  env['GEMINI_CLI_IDE_WORKSPACE_PATH'] = undefined;
  env['GEMINI_CLI_SYSTEM_SETTINGS_PATH'] = '.gemini/system-settings.json';
  env['GEMINI_CLI_TRUST_WORKSPACE'] = 'true';
  env['GEMINI_SANDBOX'] = undefined;
  const command: AgentCommand = {
    executable: 'gemini',
    args,
    input: request.prompt,
    files,
    env
  };
  const stdout = await runAgent(command, request.options);
  const envelope = parseAgentEnvelope(stdout, 'gemini');

  if (envelope['error'] !== undefined) throw new Error('Gemini CLI reported a failed response.');

  const response = envelope['response'];

  if (typeof response !== 'string') {
    const message = 'Gemini CLI returned an unsupported JSON envelope without a response string.';

    throw new Error(message);
  }

  return response;
};
