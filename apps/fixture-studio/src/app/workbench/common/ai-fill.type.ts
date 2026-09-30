import type {
  AiFillProgressEvent,
  AiFillResultEvent,
  AiTool,
  FillSource,
  MergeBody,
  MergeResult,
  MissingFile
} from '@fixture-automation/fixture-studio-api/contract';

/** Chrome's `LanguageModel.availability()` states; also used for "is this provider usable". */
export type AiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

export type AiProviderId = 'chrome' | 'cli';

/** The compared diff's trimmed prompt size; `'loading'` while a new diff is on its way, `undefined` with none. */
export type DiffPromptSize = number | 'loading' | undefined;

/** Where the on-device model stands, as the AI step walks the user through it: checking, missing, downloading, ready. */
export type OnDeviceState = 'checking' | 'downloading' | 'needs-download' | 'ready' | 'unavailable';

/** Everything a provider needs to fill the missing properties of one fixture. */
export type AiFillContext = {
  readonly specId: string;
  readonly endpointId: string;
  readonly fixture: unknown;
  readonly missing: MissingFile;
  /** The diff's `completeJson`, parsed: the schema sampler's value for every missing path, when the model gives none. */
  readonly complete: unknown;
  readonly scenario: string | undefined;
  readonly tool: AiTool;
  readonly model: string | undefined;
};

export type AiDownloadOptions = {
  readonly signal: AbortSignal;
  /** Model download progress, 0 to 1; only the on-device provider downloads. */
  readonly onDownload: (ratio: number) => void;
};

type AiProgressListener = {
  readonly onProgress: (event: AiFillProgressEvent) => void;
};

export type AiRunOptions = AiDownloadOptions & AiProgressListener;

/** The signature both providers share: resolves to the populated missing properties, ready for `merge`, and their sources. */
type AiFill = (context: AiFillContext, options: AiRunOptions) => Promise<AiFillResultEvent>;

/** Chrome's built-in Prompt API: the only provider with an availability to probe up front. */
export type ChromeAiProvider = {
  availability(): Promise<AiAvailability>;
  /** Downloads the model without prompting it; call from a click, which gives the user activation Chrome requires. */
  download(options: AiDownloadOptions): Promise<void>;
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
  /** The answer whose `populated` is in `body`, kept so the merge and what produced it are shown together. */
  readonly answer: AiFillResultEvent;
};

/** A merge together with the answer it merged: sources, notes and filled values always describe the merge on screen. */
export type MergedFill = {
  readonly answer: AiFillResultEvent;
  readonly merge: MergeResult;
};

/** One path a fill targets, and where its value came from. */
export type FilledPath = {
  readonly path: string;
  readonly source: FillSource;
};

/** What a salvage needs from the fill context: the paths to answer and the sampler's complete fixture. */
export type SalvageSource = Pick<AiFillContext, 'complete' | 'missing'>;
