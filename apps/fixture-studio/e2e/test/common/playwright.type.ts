import type { AiToolsResult, DiffResult, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import type { Locator, Route } from '@playwright/test';

/** Where an element sits on the page, or `null` when it is not rendered; Playwright does not export the type. */
export type ElementBox = Awaited<ReturnType<Locator['boundingBox']>>;

export type RouteHandler = (route: Route) => Promise<void>;

/** A route handler plus the parsed JSON bodies of the requests it answered. */
export type RecordingRoute = {
  readonly handler: RouteHandler;
  readonly bodies: unknown[];
};

/** A scenario route: the URL pattern it answers and its handler. */
export type ApiRoute = {
  readonly pattern: string;
  readonly handler: RouteHandler;
};

/** The diff each endpoint's compare answers with, keyed by endpoint id. */
export type DiffByEndpoint = Readonly<Record<string, DiffResult>>;

type Viewport = {
  readonly width: number;
  readonly height: number;
};

type ColorScheme = 'dark' | 'light';

/** One theme and width the screenshot project captures every step in. */
export type ScreenshotVariant = {
  readonly name: string;
  readonly colorScheme: ColorScheme;
  readonly viewport: Viewport;
};

/** A real local server that streams `ai-fill` NDJSON one write at a time, so chunk boundaries are the test's choice. */
export type NdjsonStream = {
  readonly url: string;
  readonly bodies: unknown[];
  /** Waits for the UI's request, then sends `text` as one chunk. */
  readonly write: (text: string) => Promise<void>;
  readonly end: () => Promise<void>;
  /** True once the browser closed the request before the stream ended. */
  readonly isAborted: () => boolean;
  readonly close: () => Promise<void>;
};

/** How the stubbed `globalThis.LanguageModel` behaves; see `installLanguageModelStub`. */
export type LanguageModelStubConfig = {
  readonly availability: LanguageModelAvailability;
  /** What `promptStreaming` yields, in order. */
  readonly chunks: string[];
  /** `quota` makes the answer stream fail with a `QuotaExceededError`. */
  readonly failure: 'none' | 'quota';
  /** `create` reports half the model downloaded, then waits for `releaseModelDownload`; once it resolves, the model is `available`. */
  readonly holdsDownload: boolean;
};

/** What the app asked the stubbed `LanguageModel.create` for: a system prompt means a session, none means a download. */
export type LanguageModelCreateCall = {
  readonly hasMonitor: boolean;
  readonly hasSystemPrompt: boolean;
};

/** How a scenario opens the studio: the spec it loads, its own routes (answering before the defaults), the window and permissions. */
export type StudioOptions = {
  readonly colorScheme?: ColorScheme;
  readonly permissions?: string[];
  readonly routes?: ApiRoute[];
  readonly spec?: LoadedSpec;
  readonly viewport?: Viewport;
};

/** How a scenario opens the AI fill step: the diff and install check it answers, its own routes, and Chrome's on-device AI. */
export type AiFillOptions = {
  readonly diff?: DiffResult;
  /** The user opted in to on-device Chrome AI on an earlier visit. */
  readonly isChromeAiOptedIn?: boolean;
  /** Chrome's Prompt API scripted by this config, before the app loads; without it the page keeps the browser's own. */
  readonly model?: LanguageModelStubConfig;
  readonly routes?: ApiRoute[];
  readonly tools?: AiToolsResult;
};

/** The partial invoice the compare fixtures hold: the schema's required fields only. */
export type PartialInvoice = {
  readonly id: string;
  readonly amount_due: number;
  readonly status: string;
};
