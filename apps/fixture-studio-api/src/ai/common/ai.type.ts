import type {
  AiFixtureOptions,
  AiFixtureProgress,
  AiMissingFactory,
  AiMissingRequest,
  AiToolInstall,
  MissingFill,
  ModelDiscovery,
  ModelDiscoveryOptions
} from '@fixture-automation/openapi-ai-fixtures';

import type { AiTool, FillSource, MissingFile } from '../../contract/common/studio-api.type.ts';
import type { SpecCompute } from '../../spec-compute/common/spec-compute.type.ts';

/** The AI entry points of `openapi-ai-fixtures`, injected so tests and `STUDIO_AI_MOCK` never spawn a paid CLI. */
export type StudioAi = {
  readonly fill: (options: AiFixtureOptions) => AiMissingFactory;
  readonly discover: (tool: AiTool, options: ModelDiscoveryOptions) => Promise<ModelDiscovery>;
  /** Which CLIs are on `PATH`; reads files only, never starts a CLI. */
  readonly detect: () => Promise<AiToolInstall[]>;
  /** True for `STUDIO_AI_MOCK=1`, whose answers come from no CLI at all. */
  readonly isMock: boolean;
};

/** A fill's values, where each missing path's value came from, and plain-language notes on any salvage. */
export type FillOutcome = {
  /** A list for a list fixture whose missing paths start at an index. */
  readonly populated: MissingFill;
  /** One entry per `missing.paths` entry. */
  readonly sources: Record<string, FillSource>;
  readonly notes: string[];
};

/** One AI fill, started by the NDJSON stream with its abort signal and progress sink. */
export type AiFillJob = (signal: AbortSignal, onProgress: (progress: AiFixtureProgress) => void) => Promise<FillOutcome>;

/** Builds the best fill it can for `missing` from a failed run's parsed answers and the sampler, off the event loop. */
export type MissingSalvager = (missing: MissingFile, candidates: unknown[], context: string) => Promise<FillOutcome>;

/** The paths of one sequential CLI run of a chunked fill. */
export type FillChunk = {
  readonly paths: string[];
  /** A lone path pattern whose prompt alone exceeds the 1 MiB CLI input limit: no CLI runs, the sampler fills its paths. */
  readonly isOversized: boolean;
};

/**
 * One CLI fill; the chunked runner splits it into sequential `enrich` calls when its prompt is too big for one answer,
 * and salvages a chunk whose run fails instead of failing the fill.
 */
export type ChunkedFillRun = {
  readonly enrich: AiMissingFactory;
  readonly salvage: MissingSalvager;
  /** Names the CLI in salvage notes. */
  readonly tool: AiTool;
  readonly schemaName: string;
  /** The whole fill: every missing path and the full fixture. */
  readonly request: AiMissingRequest;
  /** Checked between chunks, so a cancel starts no further CLI run. */
  readonly signal: AbortSignal;
  readonly onProgress: (progress: AiFixtureProgress) => void;
};

/** The server-wide cap on running AI CLI processes. */
type CliRunLimit = {
  claim(): void;
  release(): void;
};

/** What every AI route shares: the AI entry points, the CLI run cap, and the spec workers that validate a fill. */
export type FillRun = {
  readonly ai: StudioAi;
  readonly slots: CliRunLimit;
  readonly compute: SpecCompute;
};
