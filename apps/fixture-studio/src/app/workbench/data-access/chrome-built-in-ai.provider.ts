import { InjectionToken, inject } from '@angular/core';

import type { AiPromptBody, AiPromptResult } from '@fixture-automation/fixture-studio-api/contract';

import { downloadModel } from './chrome-ai-download.client.ts';
import { CLI_FALLBACK, answerInClone, baseSession, failure, fitsContext, status } from './chrome-ai-session.client.ts';
import type { EngineCall, StudioEngine, StudioEngineFailure } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import type { AiAvailability, AiDownloadOptions, AiFillContext, AiRunOptions, ChromeAiProvider } from '../common/ai-fill.type.ts';
import { mergeAnswers } from '../utils/answer-merge.util.ts';

/** What asking for a prompt needs; the session is created from the first prompt's system text. */
type PromptSource = {
  readonly engine: StudioEngine;
  readonly context: AiFillContext;
  readonly options: AiRunOptions;
};

/** A fill in progress: the base session holds only the system prompt; every answer runs in a clone of it. */
type OnDeviceFill = {
  readonly engine: StudioEngine;
  readonly context: AiFillContext;
  readonly options: AiRunOptions;
  readonly session: LanguageModelSession;
};

const NO_API = 'This browser has no on-device Chrome AI.';

const tooLarge = (cause?: unknown): StudioEngineFailure => failure('This fixture is too large for the on-device model.', CLI_FALLBACK, cause);

const isQuotaError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
};

/** Read on every call: the Prompt API global can appear after an origin trial or flag change. */
const languageModel = (): LanguageModelFactory | undefined => globalThis.LanguageModel;

/** The Prompt API, or a failure pointing at the local CLI when this browser has none. */
const requiredLanguageModel = (): LanguageModelFactory => {
  const factory = languageModel();

  if (factory === undefined) throw failure(NO_API, CLI_FALLBACK);

  return factory;
};

const download = async (options: AiDownloadOptions): Promise<void> => {
  const factory = requiredLanguageModel();

  await downloadModel(factory, options);
};

/** A fill never starts the model download: that needs its own click on "Download model". */
const assertDownloaded = async (factory: LanguageModelFactory): Promise<void> => {
  const state = await factory.availability();

  if (state === 'downloadable') throw failure('The on-device model is not downloaded yet.', 'Press "Download model" first.');
};

const availability = async (): Promise<AiAvailability> => {
  const factory = languageModel();

  if (factory === undefined) return 'unavailable';

  try {
    return await factory.availability();
  } catch {
    return 'unavailable';
  }
};

/** The prompt for `paths` with a baseline trimmed to them, or, without `paths`, for the whole fixture. */
const promptFor = async (source: PromptSource, paths: string[] | undefined): Promise<AiPromptResult> => {
  const { context, options } = source;
  let body: AiPromptBody = { endpointId: context.endpointId, fixture: context.fixture, missing: context.missing, scenario: context.scenario };

  if (paths !== undefined) body = { ...body, paths };

  const call: EngineCall = { signal: options.signal };

  return source.engine.aiPrompt(context.specId, body, call);
};

/**
 * Answers `prompt` when it fits the context window. Otherwise the whole fixture is asked again with only the parts
 * around the missing paths, and when even that is too large, each half of the paths on its own, merging the answers.
 */
const fillPaths = async (fill: OnDeviceFill, paths: string[] | undefined, prompt: AiPromptResult): Promise<unknown> => {
  const { options, session } = fill;
  const fits = await fitsContext(session, prompt, options.signal);

  if (fits) return answerInClone(session, prompt, options);

  if (paths === undefined) {
    const allPaths = fill.context.missing.paths;
    const trimmedPrompt = await promptFor(fill, allPaths);

    options.onProgress(status('The fixture is too large for one prompt; sending only the parts around the missing fields.'));

    return fillPaths(fill, allPaths, trimmedPrompt);
  }

  if (paths.length <= 1) throw tooLarge();

  const half = Math.ceil(paths.length / 2);
  const firstPaths = paths.slice(0, half);
  const secondPaths = paths.slice(half);

  options.onProgress(status(`Splitting ${paths.length} missing fields into two prompts…`));

  const firstPrompt = await promptFor(fill, firstPaths);
  const first = await fillPaths(fill, firstPaths, firstPrompt);
  const secondPrompt = await promptFor(fill, secondPaths);
  const second = await fillPaths(fill, secondPaths, secondPrompt);

  return mergeAnswers(first, second);
};

/** Fills with Chrome's built-in Prompt API (Gemini Nano); nothing leaves the browser. */
const chromeBuiltInAiProvider = (engine: StudioEngine): ChromeAiProvider => {
  const fill = async (context: AiFillContext, options: AiRunOptions): Promise<unknown> => {
    const factory = requiredLanguageModel();

    await assertDownloaded(factory);

    const source: PromptSource = { engine, context, options };
    const wholePrompt = await promptFor(source, undefined);

    try {
      const session = await baseSession(factory, wholePrompt.system, options);

      try {
        return await fillPaths({ ...source, session }, undefined, wholePrompt);
      } finally {
        session.destroy();
      }
    } catch (error) {
      const isTooLarge = isQuotaError(error);

      if (isTooLarge) throw tooLarge(error);

      throw error;
    }
  };

  const provider: ChromeAiProvider = { availability, download, fill };

  return provider;
};

const createChromeBuiltInAiProvider = (): ChromeAiProvider => chromeBuiltInAiProvider(inject(STUDIO_ENGINE));

export const CHROME_AI_PROVIDER = new InjectionToken<ChromeAiProvider>('ChromeBuiltInAiProvider', {
  providedIn: 'root',
  factory: createChromeBuiltInAiProvider
});
