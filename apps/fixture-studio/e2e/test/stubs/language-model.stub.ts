import { POPULATED_STUB } from './workbench.stub.ts';
import type { LanguageModelStubConfig } from '../common/playwright.type.ts';

const ANSWER = JSON.stringify(POPULATED_STUB);

/** The answer arrives in two chunks, split inside a string, as a streamed model answer would. */
const ANSWER_CHUNKS = [ANSWER.slice(0, 17), ANSWER.slice(17)];

export const AVAILABLE_MODEL_STUB: LanguageModelStubConfig = {
  availability: 'available',
  chunks: ANSWER_CHUNKS,
  failure: 'none',
  holdsDownload: false
};

export const DOWNLOADABLE_MODEL_STUB: LanguageModelStubConfig = {
  ...AVAILABLE_MODEL_STUB,
  availability: 'downloadable',
  holdsDownload: true
};

export const DOWNLOADING_MODEL_STUB: LanguageModelStubConfig = { ...AVAILABLE_MODEL_STUB, availability: 'downloading' };

export const UNAVAILABLE_MODEL_STUB: LanguageModelStubConfig = { ...AVAILABLE_MODEL_STUB, availability: 'unavailable' };

export const TOO_SMALL_MODEL_STUB: LanguageModelStubConfig = { ...AVAILABLE_MODEL_STUB, failure: 'quota' };
