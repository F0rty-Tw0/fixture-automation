import type {
  AiFillBody,
  AiFillProgressEvent,
  AiFillResultEvent,
  AiModelsResult,
  AiPromptBody,
  AiPromptResult,
  AiTool,
  AiToolsResult,
  DiffBody,
  DiffResult,
  EnvelopeBody,
  EnvelopeResult,
  FixtureNameQuery,
  FixtureNameResult,
  GenerateBody,
  GenerateResult,
  LoadSpecBody,
  LoadedSpec,
  MergeBody,
  MergeResult
} from '@fixture-automation/fixture-studio-api/contract';

/** Every engine call is cancellable; aborting rejects the call and stops its work. */
export type EngineCall = {
  readonly signal: AbortSignal;
};

type ProgressListener = {
  readonly onProgress: (event: AiFillProgressEvent) => void;
};

/** A cancellable call that reports progress lines while it runs. */
export type EngineStreamCall = EngineCall & ProgressListener;

/**
 * Port to whatever loads specs and builds fixtures: the local API today, an in-browser engine
 * later. Every call is cancellable through its `signal`; failures reject with a `StudioEngineFailure`.
 */
export type StudioEngine = {
  loadSpec(body: LoadSpecBody, call: EngineCall): Promise<LoadedSpec>;
  generate(specId: string, body: GenerateBody, call: EngineCall): Promise<GenerateResult>;
  diff(specId: string, body: DiffBody, call: EngineCall): Promise<DiffResult>;
  /** Names the fixture's top-level keys that could hold the payload, best match first. */
  envelope(specId: string, body: EnvelopeBody, call: EngineCall): Promise<EnvelopeResult>;
  merge(specId: string, body: MergeBody, call: EngineCall): Promise<MergeResult>;
  /** The file name the CLI merge writes for an endpoint URL, optionally under a subdirectory. */
  fixtureName(query: FixtureNameQuery, call: EngineCall): Promise<FixtureNameResult>;
  aiPrompt(specId: string, body: AiPromptBody, call: EngineCall): Promise<AiPromptResult>;
  cliModels(tool: AiTool, call: EngineCall): Promise<AiModelsResult>;
  /** Which CLIs are installed where the engine runs, and whether a mock answers instead of them. */
  cliTools(call: EngineCall): Promise<AiToolsResult>;
  /** Streams CLI progress through `onProgress` and resolves to the populated missing properties, with their sources. */
  cliFill(specId: string, body: AiFillBody, call: EngineStreamCall): Promise<AiFillResultEvent>;
};

type RecoveryHint = {
  /** How the user can recover, when the engine knows. */
  readonly fix: string | undefined;
};

/** How a `StudioEngine` rejects: a user-facing message, a recovery hint, and the original failure as `cause`. */
export type StudioEngineFailure = Error & RecoveryHint;
