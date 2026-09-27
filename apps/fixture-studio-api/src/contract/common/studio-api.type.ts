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
  generateBodySchema,
  loadSpecBodySchema,
  mergeBodySchema
} from '../studio-api.schema.ts';

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

export type DiffResult = {
  readonly missing: MissingFile;
  /** Same list as `missing.paths`, surfaced for highlighting: every path a fill targets, absent or replaced. */
  readonly missingPaths: string[];
  /** The subset of `missingPaths` that held a placeholder or schema-invalid value. */
  readonly replacedPaths: string[];
  /** The fixture without `replacedPaths`: AI fill and merge start from this, not the original fixture. */
  readonly baseline: unknown;
  /** The baseline with every missing value filled from the sampler; existing keys keep their order, new keys follow them. */
  readonly completeJson: string;
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

export type AiFillResultEvent = {
  readonly type: 'result';
  /** Only the missing properties; POST it to `merge` as `populated`. */
  readonly populated: Record<string, unknown>;
};

export type AiFillErrorEvent = {
  readonly type: 'error';
  readonly message: string;
  readonly fix: string | undefined;
};

/** One line of the `ai-fill` NDJSON stream; the last line is always a `result` or an `error`. */
export type AiFillEvent = AiFillErrorEvent | AiFillProgressEvent | AiFillResultEvent;
