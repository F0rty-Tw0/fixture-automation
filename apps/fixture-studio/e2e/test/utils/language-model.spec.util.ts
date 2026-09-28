import type { Page } from '@playwright/test';

import type { LanguageModelStubConfig } from '../common/playwright.type.ts';

const CALLS_GLOBAL = '__languageModelCalls';

const RELEASE_EVENT = 'e2e-release-model-download';

/**
 * Runs in the page before the app: replaces Chrome's Prompt API with a scripted one. It must stay
 * self-contained, since Playwright sends its source text, not its closure; the global and event names are repeated here.
 */
const installLanguageModelStub = (config: LanguageModelStubConfig): void => {
  const calls: unknown[] = [];
  const release = Promise.withResolvers<undefined>();

  Reflect.set(globalThis, '__languageModelCalls', calls);
  globalThis.addEventListener('e2e-release-model-download', (): void => release.resolve(undefined), { once: true });

  const answer = (): ReadableStream<string> => {
    const quota = new DOMException('The input is too large for the model.', 'QuotaExceededError');
    const start = (controller: ReadableStreamDefaultController<string>): void => {
      if (config.failure === 'quota') return void controller.error(quota);

      config.chunks.forEach((chunk: string): void => controller.enqueue(chunk));
      controller.close();
    };

    return new ReadableStream<string>({ start });
  };

  const promptStreaming = (input: string, options?: LanguageModelPromptOptions): ReadableStream<string> => {
    const call = { input, hasResponseConstraint: options?.responseConstraint !== undefined };

    calls.push(call);

    return answer();
  };

  const session: LanguageModelSession = { promptStreaming, destroy: (): undefined => undefined };

  const create = async (options?: LanguageModelCreateOptions): Promise<LanguageModelSession> => {
    const monitor = new EventTarget();
    const progress = (loaded: number): boolean => monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }));

    options?.monitor?.(monitor);

    if (config.holdsDownload) {
      progress(0.5);
      await release.promise;
      progress(1);
    }

    return session;
  };

  const availability = async (): Promise<LanguageModelAvailability> => Promise.resolve(config.availability);

  globalThis.LanguageModel = { availability, create };
};

export const stubLanguageModel = async (page: Page, config: LanguageModelStubConfig): Promise<void> => {
  await page.addInitScript(installLanguageModelStub, config);
};

/** Every `promptStreaming` call the app made: its prompt text and whether it sent a response schema. */
export const languageModelCalls = async (page: Page): Promise<unknown> => {
  return page.evaluate((name: string): unknown => Reflect.get(globalThis, name), CALLS_GLOBAL);
};

/** Lets a held `create` finish its download. */
export const releaseModelDownload = async (page: Page): Promise<void> => {
  await page.evaluate((name: string): boolean => globalThis.dispatchEvent(new Event(name)), RELEASE_EVENT);
};
