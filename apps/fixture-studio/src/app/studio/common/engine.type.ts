import type {
  AiFillBody,
  AiFillProgressEvent,
  AiModelsResult,
  AiPromptBody,
  AiPromptResult,
  AiTool,
  AiToolsResult,
  DiffBody,
  DiffResult,
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
  merge(specId: string, body: MergeBody, call: EngineCall): Promise<MergeResult>;
  aiPrompt(specId: string, body: AiPromptBody, call: EngineCall): Promise<AiPromptResult>;
  cliModels(tool: AiTool, call: EngineCall): Promise<AiModelsResult>;
  /** Which CLIs are installed where the engine runs, and whether a mock answers instead of them. */
  cliTools(call: EngineCall): Promise<AiToolsResult>;
  /** Streams CLI progress through `onProgress` and resolves to the populated missing properties. */
  cliFill(specId: string, body: AiFillBody, call: EngineStreamCall): Promise<Record<string, unknown>>;
};
