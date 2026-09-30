import type { AiFillProgressEvent, AiPromptResult } from '@fixture-automation/fixture-studio-api/contract';

import { downloadMonitor } from './chrome-ai-download.client.ts';
import { parseEmbeddedJson } from '../../shared/json/utils/json.util.ts';
import type { StudioEngineFailure } from '../../shared/studio-engine/common/engine.type.ts';
import type { AiRunOptions } from '../common/ai-fill.type.ts';

export const CLI_FALLBACK = 'Turn off "Use on-device Chrome AI" to fill it with the local CLI instead.';

/**
 * A prompt may use this share of the context window; the rest stays free for the answer.
 * ponytail: fixed answer reserve; measure answers against the window if chunks still overflow it.
 */
const PROMPT_SHARE = 0.75;

export const failure = (message: string, fix: string, cause?: unknown): StudioEngineFailure => {
  const error: StudioEngineFailure = Object.assign(new Error(message, { cause }), { fix });

  return error;
};

export const status = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'status', text };

  return event;
};

const output = (text: string): AiFillProgressEvent => {
  const event: AiFillProgressEvent = { type: 'progress', stream: 'stdout', text };

  return event;
};

/** Reads the streamed answer to its end, reporting each chunk as model output so the log shows the answer as it grows. */
const readAll = async (reader: ReadableStreamDefaultReader<string>, text: string, options: AiRunOptions): Promise<string> => {
  const chunk = await reader.read();

  if (chunk.done) return text;

  options.onProgress(output(chunk.value));

  return readAll(reader, text + chunk.value, options);
};

/** The model's JSON, also when it wrapped it in a Markdown fence or prose. */
const parseAnswer = (text: string): unknown => {
  const answer = parseEmbeddedJson(text);

  if (answer === undefined) {
    throw failure('The on-device model answered with text that is not JSON.', `Run it again, or ${CLI_FALLBACK.toLowerCase()}`);
  }

  return answer;
};

/** Chrome versions without structured output reject `responseConstraint` with one of these. */
const isConstraintRejected = (error: unknown): boolean => {
  const isNotSupported = error instanceof DOMException && error.name === 'NotSupportedError';

  return isNotSupported || error instanceof TypeError;
};

/**
 * Asks with the response schema; when this Chrome rejects the schema, asks once more without it. The prompt already
 * carries the missing schema, so Chrome is told not to add it to the input a second time (it isn't measured either).
 */
const answerOf = async (session: LanguageModelSession, prompt: AiPromptResult, options: AiRunOptions): Promise<string> => {
  const constrained = { responseConstraint: prompt.responseSchema, omitResponseConstraintInput: true, signal: options.signal };

  try {
    return await readAll(session.promptStreaming(prompt.prompt, constrained).getReader(), '', options);
  } catch (error) {
    const isRejected = isConstraintRejected(error);

    if (!isRejected) throw error;

    options.onProgress(status('This Chrome rejected the response schema; asking again without it.'));

    const unconstrained = { signal: options.signal };

    return readAll(session.promptStreaming(prompt.prompt, unconstrained).getReader(), '', options);
  }
};

/** A clone of `base`, so answers don't see each other's history; Chrome versions without `clone` answer in `base`. */
const answerSession = async (base: LanguageModelSession, signal: AbortSignal): Promise<LanguageModelSession> => {
  if (base.clone === undefined) return base;

  return base.clone({ signal });
};

/** The model's session, created with the system prompt; creating it may download the model first. */
export const baseSession = async (
  factory: LanguageModelFactory,
  system: string,
  options: AiRunOptions
): Promise<LanguageModelSession> => {
  const systemPrompt: LanguageModelPrompt = { role: 'system', content: system };
  const initialPrompts = [systemPrompt];
  const monitor = downloadMonitor(options.onDownload);

  options.onProgress(status('Starting the on-device model…'));

  return factory.create({ initialPrompts, monitor, signal: options.signal });
};

/** Whether the prompt leaves the answer its share of the context; Chrome versions that can't measure are trusted. */
export const fitsContext = async (session: LanguageModelSession, prompt: AiPromptResult, signal: AbortSignal): Promise<boolean> => {
  const { contextWindow, contextUsage = 0 } = session;

  if (contextWindow === undefined || session.measureContextUsage === undefined) return true;

  const promptUsage = await session.measureContextUsage(prompt.prompt, { signal });

  return contextUsage + promptUsage <= contextWindow * PROMPT_SHARE;
};

/** One schema-constrained answer, parsed, in its own clone of the base session. */
export const answerInClone = async (base: LanguageModelSession, prompt: AiPromptResult, options: AiRunOptions): Promise<unknown> => {
  const session = await answerSession(base, options.signal);

  try {
    options.onProgress(status('Generating the missing properties…'));

    const answer = await answerOf(session, prompt, options);

    options.onProgress(status(`The model answered with ${answer.length} characters.`));

    return parseAnswer(answer);
  } finally {
    if (session !== base) session.destroy();
  }
};
