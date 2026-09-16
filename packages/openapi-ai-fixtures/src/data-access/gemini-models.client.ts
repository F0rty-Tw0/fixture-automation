import { readFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { isAbsolute } from 'node:path';

import { isMissingFile, isRecord } from '@fixture-automation/shared';

import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentFile, AgentRespond } from '../common/agent.type.ts';
import type { ModelDiscoveryOptions } from '../common/model.type.ts';
import { assertSafeGeminiSystemSettings } from '../utils/gemini-settings.util.ts';
import { modelNames, modelRpcRequest, modelRpcResult } from '../utils/model-discovery.util.ts';

const INITIALIZE_ID = 1;
const SESSION_ID = 2;
const experimental = { autoMemory: false, enableAgents: false };
const general = { enableAutoUpdate: false, enableAutoUpdateNotification: false };
const hooksConfig = { enabled: false };
const ide = { enabled: false, hasSeenNudge: true };
const skills = { enabled: false };
const tools = { core: [], discoveryCommand: '' };
const settings = { experimental, general, hooksConfig, ide, skills, tools };
const GEMINI_SETTINGS_CONTENT = `${JSON.stringify(settings, null, 2)}\n`;

const geminiSystemSettingsPath = (): string => {
  const configured = process.env['GEMINI_CLI_SYSTEM_SETTINGS_PATH'];

  if (configured) {
    const isConfiguredPathAbsolute = isAbsolute(configured);

    if (!isConfiguredPathAbsolute) throw new Error('Gemini model discovery cannot verify a relative system settings path');

    return configured;
  }

  const currentPlatform = platform();

  if (currentPlatform === 'darwin') return '/Library/Application Support/GeminiCli/settings.json';

  if (currentPlatform === 'win32') return 'C:\\ProgramData\\gemini-cli\\settings.json';

  return '/etc/gemini-cli/settings.json';
};

const assertSafeSystemSettings = async (path: string): Promise<void> => {
  let content: string;

  try {
    content = await readFile(path, 'utf8');
  } catch (error: unknown) {
    const isMissing = isMissingFile(error);

    if (isMissing) return;

    throw new Error('Gemini model discovery could not verify managed system settings', { cause: error });
  }

  assertSafeGeminiSystemSettings(content);
};

const geminiCommand = (respond: AgentRespond): AgentCommand => {
  const clientCapabilities = {};
  const initializeParams = { clientCapabilities, protocolVersion: 1 };
  const input = modelRpcRequest(INITIALIZE_ID, 'initialize', initializeParams);
  const args = ['--acp', '--extensions', 'none'];
  const settingsFile: AgentFile = {
    path: '.gemini/settings.json',
    content: GEMINI_SETTINGS_CONTENT
  };
  const env: Record<string, string | undefined> = {};

  env['GEMINI_CLI_IDE_AUTH_TOKEN'] = undefined;
  env['GEMINI_CLI_IDE_PID'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_PORT'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_STDIO_ARGS'] = undefined;
  env['GEMINI_CLI_IDE_SERVER_STDIO_COMMAND'] = undefined;
  env['GEMINI_CLI_IDE_WORKSPACE_PATH'] = undefined;
  env['GEMINI_CLI_TRUST_WORKSPACE'] = 'true';
  env['GEMINI_SANDBOX'] = undefined;
  env['NO_BROWSER'] = 'true';

  const command: AgentCommand = {
    executable: 'gemini',
    args,
    input,
    files: [settingsFile],
    env,
    respond
  };

  return command;
};

export const geminiModels = async (options: ModelDiscoveryOptions): Promise<string[]> => {
  const isRestricted = process.env['GEMINI_RESTRICTED_MODE'] === 'true';

  if (isRestricted) throw new Error('Gemini restricted mode prevents isolated model discovery settings');

  const systemSettingsPath = geminiSystemSettingsPath();

  await assertSafeSystemSettings(systemSettingsPath);

  let models: string[] | undefined;
  let initialized = false;
  const respond: AgentRespond = (message, scratchDirectory): string | null | undefined => {
    const requestId = initialized ? SESSION_ID : INITIALIZE_ID;
    const result = modelRpcResult(message, requestId);

    if (result === undefined) return undefined;

    if (!initialized) {
      if (result['protocolVersion'] !== 1) throw new Error('Gemini returned an unsupported ACP protocol version');

      initialized = true;
      const params = { cwd: scratchDirectory, mcpServers: [] };

      return modelRpcRequest(SESSION_ID, 'session/new', params);
    }

    const catalog = result['models'];

    if (!isRecord(catalog)) throw new Error('Gemini returned an invalid model catalog');

    models = modelNames(catalog['availableModels'], 'modelId');

    return null;
  };
  const command = geminiCommand(respond);

  await runAgent(command, { ...options, tool: 'gemini' });

  if (models === undefined) throw new Error('Gemini closed before returning its model catalog');

  return models;
};
