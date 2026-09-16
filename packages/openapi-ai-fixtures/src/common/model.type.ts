import type { AiFixtureOptions, AiTool } from './ai-fixtures.type.ts';

type ModelSource = `${AiTool}-cli`;

/** Catalog queries retain a 120000 ms default; timeoutMs overrides it. */
export type ModelDiscoveryOptions = Pick<AiFixtureOptions, 'executable' | 'signal' | 'timeoutMs'>;

/** Reads one answer from the operator. Injected so selection can be tested without a terminal. */
type ModelPrompt = (question: string) => Promise<string>;

export type ModelDiscovery = {
  /** Opaque selectable identifiers reported by the installed provider. */
  readonly models: string[];
  readonly source: ModelSource;
};

export type ModelSelection = {
  readonly tool: AiTool;
  /** An explicit `--model` value; it is passed through even when it is not in `discovery.models`. */
  readonly requested?: string;
  /** True only when stdin is a terminal, which is when prompting is allowed. */
  readonly interactive: boolean;
  readonly discovery?: ModelDiscovery;
  readonly discoveryOptions?: ModelDiscoveryOptions;
  /** Overrides the built-in `node:readline/promises` prompt. */
  readonly prompt?: ModelPrompt;
};
