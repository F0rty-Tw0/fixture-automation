import type { AiTool } from './ai-fixtures.type.ts';

/** Where a model list came from: a harness-owned cache file, or this package's curated fallback. */
type ModelSource = 'codex-cache' | 'curated';

/** Reads one answer from the operator. Injected so selection can be tested without a terminal. */
type ModelPrompt = (question: string) => Promise<string>;

export type ModelDiscovery = {
  /** Selectable model slugs; empty when the harness exposes no model switch. */
  readonly models: string[];
  readonly source: ModelSource;
};

export type ModelSelection = {
  readonly tool: AiTool;
  /** An explicit `--model` value; it is passed through even when it is not in `discovery.models`. */
  readonly requested?: string;
  /** True only when both stdin and stdout are terminals, which is when prompting is allowed. */
  readonly interactive: boolean;
  readonly discovery: ModelDiscovery;
  /** Overrides the built-in `node:readline/promises` prompt. */
  readonly prompt?: ModelPrompt;
};
