import { runAgent } from './agent-process.client.ts';
import type { AgentCommand, AgentFile, AgentRequest } from '../common/agent.type.ts';
import type { AiFixtureProgress } from '../common/ai-fixtures.type.ts';
import { parseAgentEnvelope } from '../utils/agent-response.util.ts';
import { parseGeminiStream } from '../utils/gemini-stream.util.ts';
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
const GEMINI_ARGS = [
  '--prompt',
  GEMINI_PROMPT,
  '--output-format',
  'stream-json',
  '--approval-mode',
  'default',
  '--extensions',
  'none'
];

type GeminiProgressReporter = (progress: AiFixtureProgress) => void;

const reportStatus = (report: GeminiProgressReporter, text: string): void => {
  const progress: AiFixtureProgress = { stream: 'status', text };

  report(progress);
};

const reportStdout = (report: GeminiProgressReporter, text: string): void => {
  const progress: AiFixtureProgress = { stream: 'stdout', text };

  report(progress);
};

const reportGeminiStreamLine = (line: string, report: GeminiProgressReporter): void => {
  let event: Record<string, unknown>;

  try {
    event = parseAgentEnvelope(line, 'gemini');
  } catch {
    reportStatus(report, 'Gemini emitted malformed stream JSONL.\n');

    return;
  }

  const type = event['type'];

  if (type === 'init') {
    const model = event['model'];

    if (typeof model === 'string') {
      reportStatus(report, `Gemini session initialized with ${model}.\n`);
    }

    return;
  }

  if (type === 'message') {
    const role = event['role'];
    const content = event['content'];
    const isAssistant = role === 'assistant';

    if (isAssistant && typeof content === 'string') reportStdout(report, content);

    return;
  }

  if (type === 'error') {
    const message = event['message'];
    const severity = event['severity'];

    if (typeof message === 'string' && typeof severity === 'string') {
      reportStatus(report, `Gemini ${severity}: ${message}\n`);
    }
  }
};

const geminiProgressReporter = (report: GeminiProgressReporter): GeminiProgressReporter => {
  let remaining = '';

  return (progress: AiFixtureProgress): void => {
    if (progress.stream !== 'stdout') {
      report(progress);

      return;
    }

    const output = `${remaining}${progress.text}`;
    const lines = output.split(/\r?\n/);
    const finalLine = lines.pop();

    remaining = finalLine ?? '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      const isBlank = trimmedLine.length === 0;

      if (!isBlank) reportGeminiStreamLine(line, report);
    }
  };
};

/** Enriches a fixture through Gemini's strict stream-json headless protocol. */
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
  const onProgress = request.options.onProgress;
  let options = request.options;

  if (onProgress !== undefined) {
    const reporter = geminiProgressReporter(onProgress);

    options = { ...request.options, onProgress: reporter };
  }
  const stdout = await runAgent(command, options);
  const response = parseGeminiStream(stdout);

  return response;
};
