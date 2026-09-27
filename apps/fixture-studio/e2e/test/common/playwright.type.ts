import type { Locator, Route } from '@playwright/test';

/** Where an element sits on the page, or `null` when it is not rendered; Playwright does not export the type. */
export type ElementBox = Awaited<ReturnType<Locator['boundingBox']>>;

export type RouteHandler = (route: Route) => Promise<void>;

/** A route handler plus the parsed JSON bodies of the requests it answered. */
export type RecordingRoute = {
  readonly handler: RouteHandler;
  readonly bodies: unknown[];
};

type Viewport = {
  readonly width: number;
  readonly height: number;
};

/** One theme and width the screenshot project captures every step in. */
export type ScreenshotVariant = {
  readonly name: string;
  readonly colorScheme: 'dark' | 'light';
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
  /** `create` reports half the model downloaded, then waits for `releaseModelDownload`. */
  readonly holdsDownload: boolean;
};

/** The partial invoice the compare fixtures hold: the schema's required fields only. */
export type PartialInvoice = {
  readonly id: string;
  readonly amount_due: number;
  readonly status: string;
};
