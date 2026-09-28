import type { AiFillProgressEvent, AiTool, MergeBody, MissingFile } from '@fixture-automation/fixture-studio-api/contract';

/** Chrome's `LanguageModel.availability()` states; also used for "is this provider usable". */
export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type AiProviderId = 'chrome' | 'cli';

/** Everything a provider needs to fill the missing properties of one fixture. */
export type AiFillContext = {
  readonly specId: string;
  readonly endpointId: string;
  readonly fixture: unknown;
  readonly missing: MissingFile;
  readonly scenario: string | undefined;
  readonly tool: AiTool;
  readonly model: string | undefined;
};

export type AiRunOptions = {
  readonly signal: AbortSignal;
  readonly onProgress: (event: AiFillProgressEvent) => void;
  /** Model download progress, 0 to 1; only the on-device provider downloads. */
  readonly onDownload: (ratio: number) => void;
};

/** The signature both providers share: resolves to the populated missing properties, ready for `merge`. */
type AiFill = (context: AiFillContext, options: AiRunOptions) => Promise<unknown>;

/** Chrome's built-in Prompt API: the only provider with an availability to probe up front. */
export type ChromeAiProvider = {
  availability(): Promise<AiAvailability>;
  readonly fill: AiFill;
};

/** Model of the AI fill form. */
export type AiFillForm = {
  readonly scenario: string;
  readonly tool: AiTool;
  /** Empty means the CLI's default model. */
  readonly model: string;
};

export type AiRunRequest = {
  readonly provider: AiProviderId;
  readonly context: AiFillContext;
  /** The envelope the diff used, sent on to `merge` so the populated values land inside it. */
  readonly objectShape: string | undefined;
};

export type MergeRequest = {
  readonly specId: string;
  readonly body: MergeBody;
};
