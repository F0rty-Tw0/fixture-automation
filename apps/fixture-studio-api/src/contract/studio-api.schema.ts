import { z } from 'zod';

export const FIXTURE_FORMATS = ['json', 'stub', 'types'] as const;

/** Installed coding CLIs the API can drive; mirrors `AiTool` of `openapi-ai-fixtures`. */
export const AI_TOOLS = ['claude', 'codex', 'antigravity', 'copilot', 'gemini'] as const;

export const AI_PROGRESS_STREAMS = ['stdout', 'stderr', 'status'] as const;

/** A model slug as the CLIs take it; it cannot start with `-`, so it never reads as a flag. */
const MODEL_SLUG = /^[A-Za-z0-9][\w.:/@-]{0,127}$/;

export const SCHEMA_DIALECTS = ['draft-07', 'openapi-30', 'openapi-31'] as const;

/** A spec comes from an http(s) URL or as an uploaded document; `file://` is refused so the API never reads local files for a caller. */
export const loadSpecBodySchema = z.union([
  z.object({ url: z.url({ protocol: /^https?$/ }) }),
  z.object({ document: z.record(z.string(), z.unknown()) })
]);

export const specParamsSchema = z.object({ specId: z.string().min(1) });

export const generateBodySchema = z.object({
  endpointIds: z.array(z.string().min(1)).min(1),
  formats: z.array(z.enum(FIXTURE_FORMATS)).min(1),
  requiredOnly: z.boolean()
});

/** The `missing` part of a diff result, sent back unchanged to `ai-prompt` and `ai-fill`. */
export const missingFileSchema = z.object({
  schemaName: z.string().min(1),
  dialect: z.enum(SCHEMA_DIALECTS),
  paths: z.array(z.string()),
  schema: z.record(z.string(), z.unknown()),
  components: z.object({ schemas: z.record(z.string(), z.unknown()) })
});

/**
 * `fixture` is the parsed JSON the browser read locally; `objectShape` names an envelope property holding the payload.
 * `replacePlaceholders`, on unless `false`, also refills present values that break the schema or are openapi-sampler defaults.
 */
export const diffBodySchema = z.object({
  endpointId: z.string().min(1),
  fixture: z.unknown(),
  requiredOnly: z.boolean(),
  objectShape: z.string().optional(),
  replacePlaceholders: z.boolean().optional()
});

/** `fixture` is the diff's baseline; `original`, the fixture it was cut from, sets the key order of `mergedJson`. */
export const mergeBodySchema = z.object({
  endpointId: z.string().min(1),
  fixture: z.unknown(),
  populated: z.unknown(),
  objectShape: z.string().optional(),
  original: z.unknown().optional()
});

/** `paths` asks for a chunk: each must be one of `missing.paths`; omitted, the prompt covers every missing path. */
export const aiPromptBodySchema = z.object({
  endpointId: z.string().min(1),
  fixture: z.unknown(),
  missing: missingFileSchema,
  scenario: z.string().optional(),
  paths: z.array(z.string().min(1)).min(1).optional()
});

export const aiModelsQuerySchema = z.object({ tool: z.enum(AI_TOOLS) });

const aiToolStatusSchema = z.object({ tool: z.enum(AI_TOOLS), installed: z.boolean() });

/** `installed` means the CLI's executable is on the API's `PATH`; `mock` means `STUDIO_AI_MOCK=1` answers instead of any CLI. */
export const aiToolsResultSchema = z.object({ tools: z.array(aiToolStatusSchema), mock: z.boolean() });

export const aiFillBodySchema = z.object({
  endpointId: z.string().min(1),
  fixture: z.unknown(),
  missing: missingFileSchema,
  tool: z.enum(AI_TOOLS),
  model: z.string().regex(MODEL_SLUG).optional(),
  scenario: z.string().optional()
});
