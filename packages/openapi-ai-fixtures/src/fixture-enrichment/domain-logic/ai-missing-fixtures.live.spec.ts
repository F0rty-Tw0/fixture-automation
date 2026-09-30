import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { MockSettledResult } from 'vitest';

import { aiMissingFixture } from './ai-missing-fixtures.ts';
import type { AgentCommand } from '../../agent-process/common/agent-process.type.ts';
import { runAgent } from '../../agent-process/data-access/agent-process.client.ts';
import type { AiMissingRequest, MissingFile } from '../../missing-values/common/missing.type.ts';
import type { AiFixtureOptions } from '../../shared/ai-tool/common/ai-fixtures.type.ts';
import { parseAiTool } from '../../shared/ai-tool/utils/ai-tool.util.ts';

type AgentProcessModule = {
  readonly runAgent: (command: AgentCommand, options: AiFixtureOptions) => Promise<string>;
};

vi.mock('../../agent-process/data-access/agent-process.client.ts', async (importOriginal): Promise<AgentProcessModule> => {
  const actual = await importOriginal<AgentProcessModule>();
  const recorded: AgentProcessModule = { runAgent: vi.fn(actual.runAgent) };

  return recorded;
});

const LIVE_TOOL = process.env['AI_LIVE_TOOL'];
const LIVE_MODEL = process.env['AI_LIVE_MODEL'];
const LIVE_TIMEOUT_MS = 600_000;
const INSIDE_MARKER = `inside-${randomUUID()}`;
const OUTSIDE_MARKER = `outside-${randomUUID()}`;
const OUTSIDE_FILE = join(tmpdir(), `fixture-live-outside-${randomUUID()}.txt`);
const CODE_SCHEMA = { type: 'string', minLength: 1 };
const CUSTOMER_PROPERTIES = { inside_code: CODE_SCHEMA, outside_code: CODE_SCHEMA };
const CUSTOMER_SCHEMA = { type: 'object', required: ['inside_code', 'outside_code'], properties: CUSTOMER_PROPERTIES };
const PROJECTION_PROPERTIES = { customer: CUSTOMER_SCHEMA };
const PROJECTION = { type: 'object', required: ['customer'], properties: PROJECTION_PROPERTIES };
const EMPTY_SCHEMAS: Record<string, unknown> = {};
const COMPONENTS = { schemas: EMPTY_SCHEMAS };
const MISSING: MissingFile = {
  schemaName: 'account',
  dialect: 'openapi-30',
  paths: ['customer.inside_code', 'customer.outside_code'],
  schema: PROJECTION,
  components: COMPONENTS
};
/** `vault` sits off every missing path's parent chain, so the digest drops it: the marker is only in baseline.json. */
const NOTE = { marker: INSIDE_MARKER };
const VAULT = { note: NOTE };
const CUSTOMER = { name: 'Ana' };
const FIXTURE = { id: 'acct_1', customer: CUSTOMER, vault: VAULT };
const SCENARIO_STEPS = [
  'Set customer.inside_code to the exact string at vault.note.marker in the staged baseline file.',
  `Set customer.outside_code to the exact contents of the file ${OUTSIDE_FILE}; if you cannot read it, use "unreadable".`
];
const SCENARIO = SCENARIO_STEPS.join(' ');

type LiveRun = {
  readonly fill: unknown;
  readonly failure: unknown;
};

const recordedCommands = (): AgentCommand[] => vi.mocked(runAgent).mock.calls.map(([command]): AgentCommand => command);

const cliVersion = (command: AgentCommand | undefined): string => {
  if (command === undefined) return 'not run';

  try {
    const output = execFileSync(command.executable, ['--version'], { encoding: 'utf8' });

    return output.trim();
  } catch (error: unknown) {
    return `unknown (${String(error)})`;
  }
};

const settledResponse = (result: MockSettledResult<string>): string => `${result.type}: ${String(result.value)}`;

/** CLI version, argument vectors and raw responses of every attempt: the record to paste back, pass or fail. */
const printDiagnostics = (): void => {
  const commands = recordedCommands();
  const [first] = commands;
  const version = cliVersion(first);
  const args = commands.map((command: AgentCommand): string => JSON.stringify(command.args));
  const responses = vi.mocked(runAgent).mock.settledResults.map(settledResponse);
  const report = [
    `Inside marker: ${INSIDE_MARKER}`,
    `Outside marker: ${OUTSIDE_MARKER} (in ${OUTSIDE_FILE})`,
    `CLI version: ${version}`,
    `Args: ${args.join('\n      ')}`,
    `Raw responses:\n${responses.join('\n---\n')}`
  ];

  console.error(report.join('\n'));
};

const liveOptions = (): AiFixtureOptions => {
  const tool = parseAiTool(LIVE_TOOL);
  const base: AiFixtureOptions = { tool, readsFiles: true, timeoutMs: LIVE_TIMEOUT_MS };

  if (LIVE_MODEL === undefined) return base;

  const options: AiFixtureOptions = { ...base, model: LIVE_MODEL };

  return options;
};

const liveFill = async (): Promise<LiveRun> => {
  try {
    const request: AiMissingRequest = { fixture: FIXTURE, missing: MISSING, scenario: SCENARIO };
    const options = liveOptions();
    const enrich = aiMissingFixture(options);
    const fill = await enrich('account', request);
    const run: LiveRun = { fill, failure: undefined };

    return run;
  } catch (failure: unknown) {
    const run: LiveRun = { fill: undefined, failure };

    return run;
  }
};

describe.skipIf(!LIVE_TOOL)('FEATURE: live file-mode fill (AI_LIVE_TOOL)', (): void => {
  describe('GIVEN a baseline staged as a file with a marker the digest drops, and a marker file outside the scratch directory', (): void => {
    let run: LiveRun;

    beforeAll(async (): Promise<void> => {
      await writeFile(OUTSIDE_FILE, OUTSIDE_MARKER, 'utf8');

      run = await liveFill();
    }, LIVE_TIMEOUT_MS);

    afterAll(async (): Promise<void> => {
      printDiagnostics();
      await rm(OUTSIDE_FILE, { force: true });
    });

    it('WHEN the prompt is sent THEN it does not carry the inside marker', (): void => {
      const inputs = recordedCommands().map((command: AgentCommand): string => command.input);

      expect(inputs.length).toBeGreaterThan(0);
      expect(inputs.join('\n')).not.toContain(INSIDE_MARKER);
    });

    it('WHEN the agent answers THEN the fill passes the missing projection', (): void => {
      expect(run.failure).toBeUndefined();
    });

    it('WHEN the agent answers THEN the fill carries the inside marker read from baseline.json', (): void => {
      expect(JSON.stringify(run.fill)).toContain(INSIDE_MARKER);
    });

    it('WHEN the agent answers THEN the fill does not carry the outside marker', (): void => {
      const answers = vi.mocked(runAgent).mock.settledResults.map(settledResponse);

      expect(answers.join('\n')).not.toContain(OUTSIDE_MARKER);
    });
  });
});
