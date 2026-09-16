import type { SchemaMap } from '@fixture-automation/openapi-fixtures';

export type AiTool = 'claude' | 'codex' | 'antigravity' | 'copilot' | 'gemini';

export type AiFixtureProgress = {
  readonly stream: 'stdout' | 'stderr' | 'status';
  readonly text: string;
};

export type AiFixtureOptions = {
  /** Installed coding tool to invoke; there is no automatic fallback. */
  readonly tool: AiTool;
  /** Optional absolute path to the tool executable or Node.js entry point. */
  readonly executable?: string;
  /**
   * Model slug passed straight to the selected tool. Omitting it, or passing the
   * literal `'default'`, adds no model flag and leaves the harness default in place.
   */
  readonly model?: string;
  /** Generation timeout: integer milliseconds from 1 to 2147483647. Defaults to 900000 (15 minutes). */
  readonly timeoutMs?: number;
  /** Receives live provider output and lifecycle status. Throwing cancels the operation. Omitted means no progress output. */
  readonly onProgress?: (progress: AiFixtureProgress) => void;
  /** Cancels generation and terminates the child process tree. */
  readonly signal?: AbortSignal;
  /** Base path for failed-response diagnostic sidecars; absent disables persistence. */
  readonly recoveryFile?: string;
};

export type AiFixtureRequest<TFixture = Record<string, unknown>> = {
  /** Existing JSON fixture to enrich, without mutating it. */
  readonly fixture: TFixture;
  /** Natural-language scenario; the schema remains authoritative. */
  readonly scenario: string;
};

export type AiFixtureFactory<TComponents extends SchemaMap = SchemaMap> = <TSchemaName extends keyof TComponents['schemas'] & string>(
  name: TSchemaName,
  request: AiFixtureRequest<TComponents['schemas'][TSchemaName]>
) => Promise<TComponents['schemas'][TSchemaName]>;
