import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { LanguageModelCreateCall, LanguageModelStubConfig } from '../common/playwright.type.ts';

const CALLS_GLOBAL = '__languageModelCalls';

const CREATES_GLOBAL = '__languageModelCreates';

const RELEASE_EVENT = 'e2e-release-model-download';

/**
 * Runs in the page before the app: replaces Chrome's Prompt API with a scripted one. It must stay
 * self-contained, since Playwright sends its source text, not its closure; the global and event names are repeated here.
 */
const installLanguageModelStub = (config: LanguageModelStubConfig): void => {
  const calls: unknown[] = [];
  const creates: LanguageModelCreateCall[] = [];
  const release = Promise.withResolvers<undefined>();
  let current: LanguageModelAvailability = config.availability;

  Reflect.set(globalThis, '__languageModelCalls', calls);
  Reflect.set(globalThis, '__languageModelCreates', creates);
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
    const created: LanguageModelCreateCall = {
      hasMonitor: options?.monitor !== undefined,
      hasSystemPrompt: options?.initialPrompts !== undefined
    };

    creates.push(created);
    const progress = (loaded: number): boolean => monitor.dispatchEvent(Object.assign(new Event('downloadprogress'), { loaded }));

    options?.monitor?.(monitor);

    if (config.holdsDownload) {
      progress(0.5);
      await release.promise;
      progress(1);
    }

    current = 'available';

    return session;
  };

  const availability = async (): Promise<LanguageModelAvailability> => Promise.resolve(current);

  globalThis.LanguageModel = { availability, create };
};

export const stubLanguageModel = async (page: Page, config: LanguageModelStubConfig): Promise<void> => {
  await page.addInitScript(installLanguageModelStub, config);
};

const readGlobal = (name: string): unknown => Reflect.get(globalThis, name);

/** Every `promptStreaming` call the app made, in order: its prompt text and whether it sent a response schema. */
export const expectPromptCalls = async (page: Page, calls: unknown[]): Promise<void> => {
  const promptCalls = async (): Promise<unknown> => page.evaluate(readGlobal, CALLS_GLOBAL);

  await expect.poll(promptCalls).toEqual(calls);
};

/** Every `create` call the app made, in order: a download creates without a system prompt, a fill's session with one. */
export const expectModelCreates = async (page: Page, creates: LanguageModelCreateCall[]): Promise<void> => {
  const createCalls = async (): Promise<unknown> => page.evaluate(readGlobal, CREATES_GLOBAL);

  await expect.poll(createCalls).toEqual(creates);
};

/** Lets a held `create` finish its download. */
export const releaseModelDownload = async (page: Page): Promise<void> => {
  await page.evaluate((name: string): boolean => globalThis.dispatchEvent(new Event(name)), RELEASE_EVENT);
};
