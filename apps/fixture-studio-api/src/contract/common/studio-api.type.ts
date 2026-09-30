import type { z } from 'zod';

import type {
  AI_PROGRESS_STREAMS,
  AI_TOOLS,
  FIXTURE_FORMATS,
  SCHEMA_DIALECTS,
  aiFillBodySchema,
  aiModelsQuerySchema,
  aiPromptBodySchema,
  aiToolsResultSchema,
  diffBodySchema,
  envelopeBodySchema,
  generateBodySchema,
  loadSpecBodySchema,
  mergeBodySchema
} from './studio-api.schema.ts';

export type LoadSpecBody = z.infer<typeof loadSpecBodySchema>;

export type GenerateBody = z.infer<typeof generateBodySchema>;

export type FixtureFormat = (typeof FIXTURE_FORMATS)[number];

/** One operation of the spec; `id` is `METHOD /path`, e.g. `GET /v1/invoices/{invoice}`. */
export type Endpoint = {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly summary: string | undefined;
  readonly tags: string[];
  /** Named response schema, or `null` when the operation has none the pipeline can sample. */
  readonly schemaName: string | null;
  /** Why `schemaName` is `null` (inline schema, no JSON response, ...). */
  readonly unsupportedReason: string | undefined;
};

export type LoadedSpec = {
  readonly specId: string;
  readonly title: string;
  readonly version: string;
  readonly endpoints: Endpoint[];
};

/** Generated sources for one endpoint; each format is present only when requested. */
export type GeneratedFixture = {
  readonly endpointId: string;
  readonly schemaName: string;
  readonly json: string | undefined;
  readonly stub: string | undefined;
  readonly types: string | undefined;
};

export type GenerateResult = {
  readonly fixtures: GeneratedFixture[];
};

/** Error body for every non-2xx response; mirrors the CLI's `what` / `fix` lines. */
export type ApiErrorBody = {
  readonly message: string;
  readonly fix: string | undefined;
};

export type SchemaDialect = (typeof SCHEMA_DIALECTS)[number];

export type AiTool = (typeof AI_TOOLS)[number];

export type AiProgressStream = (typeof AI_PROGRESS_STREAMS)[number];

type MissingComponents = {
  readonly schemas: Record<string, unknown>;
};

/** The `missing.json` contract of `openapi-fixture-diff`: only the absent properties, self-contained. */
export type MissingFile = {
  readonly schemaName: string;
  readonly dialect: SchemaDialect;
  /** Dotted paths of the absent values, `[i]` for array indices, prefixed by `objectShape` when one was given. */
  readonly paths: string[];
  /** Nested JSON Schema holding only the absent properties. */
  readonly schema: unknown;
  readonly components: MissingComponents;
};

export type DiffBody = z.infer<typeof diffBodySchema>;

/** A present value the schema rejects or that is an openapi-sampler placeholder. */
export type BrokenValue = {
  /** Same path form as `missingPaths`, prefixed by `objectShape` when one was given. */
  readonly path: string;
  /** The value found in the fixture. */
  readonly value: unknown;
  /** Why it is broken, e.g. `must be integer` or `openapi-sampler placeholder`. */
  readonly reason: string;
};

export type DiffResult = {
  readonly missing: MissingFile;
  /** Same list as `missing.paths`, surfaced for highlighting: every path a fill targets, absent or replaced. */
  readonly missingPaths: string[];
  /** The subset of `missingPaths` that held a placeholder or schema-invalid value. */
  readonly replacedPaths: string[];
  /** Every broken value, reported whether or not `replacePlaceholders` asked to refill them. */
  readonly broken: BrokenValue[];
  /** The fixture without `replacedPaths`: AI fill and merge start from this, not the original fixture. */
  readonly baseline: unknown;
  /** The baseline with every missing value filled from the sampler; existing keys keep their order, new keys follow them. */
  readonly completeJson: string;
  /** UTF-8 size of the browser-model prompt for every missing path over the trimmed baseline, default scenario; 0 when nothing is missing. */
  readonly promptBytes: number;
  /** Parts of the diff that fell back instead of failing it, in plain language; absent or empty when none did. */
  readonly warnings?: string[];
};

export type EnvelopeBody = z.infer<typeof envelopeBodySchema>;

/** Top-level keys holding an object or array, best match first; `detected` is set only when one fits the schema better than the root. */
export type EnvelopeResult = {
  readonly candidates: string[];
  readonly detected: string | undefined;
};

export type MergeBody = z.infer<typeof mergeBodySchema>;

/** A schema violation is still a 200: `valid` is false and `errors` lists `path: message` lines. */
export type MergeResult = {
  readonly mergedJson: string;
  readonly filled: string[];
  readonly valid: boolean;
  readonly errors: string[];
};

/** The body with `missing` typed as the `MissingFile` a diff returns, so it can be sent back unchanged. */
type MissingBody = {
  readonly missing: MissingFile;
};

export type AiPromptBody = MissingBody & Omit<z.infer<typeof aiPromptBodySchema>, 'missing'>;

/** Inputs for an on-device model; `responseSchema` is self-contained (`$defs`, no external `$ref`) for `responseConstraint`. */
export type AiPromptResult = {
  readonly system: string;
  readonly prompt: string;
  readonly responseSchema: Record<string, unknown>;
};

export type AiModelsQuery = z.infer<typeof aiModelsQuerySchema>;

export type AiModelsResult = {
  readonly models: string[];
  readonly source: string;
};

export type AiToolsResult = z.infer<typeof aiToolsResultSchema>;

export type AiToolStatus = AiToolsResult['tools'][number];

export type AiFillBody = MissingBody & Omit<z.infer<typeof aiFillBodySchema>, 'missing'>;

export type AiFillProgressEvent = {
  readonly type: 'progress';
  readonly stream: AiProgressStream;
  /** CLI output with terminal control codes removed. */
  readonly text: string;
};

/**
 * Where a missing path's value in `populated` came from: `ai` when the model's value passed the missing projection,
 * `sampler` when salvage filled it from the schema sampler because the model's answer failed, omitted it or never
 * arrived, `unfilled` when neither produced a schema-valid value.
 */
export type FillSource = 'ai' | 'sampler' | 'unfilled';

export type AiFillResultEvent = {
  readonly type: 'result';
  /**
   * Only the missing properties; POST it to `merge` as `populated`. An array for a list fixture whose missing paths
   * start at an index (`[1].created`), an object otherwise.
   */
  readonly populated: Record<string, unknown> | unknown[];
  /** Per `missing.paths` entry, where its value came from; absent means every value is the model's own. */
  readonly sources?: Record<string, FillSource>;
  /** Plain-language salvage notes for the user, e.g. why a chunk fell back to the sampler; absent or empty when none. */
  readonly notes?: string[];
};

export type AiFillErrorEvent = {
  readonly type: 'error';
  readonly message: string;
  readonly fix: string | undefined;
};

/** One line of the `ai-fill` NDJSON stream; the last line is always a `result` or an `error`. */
export type AiFillEvent = AiFillErrorEvent | AiFillProgressEvent | AiFillResultEvent;
