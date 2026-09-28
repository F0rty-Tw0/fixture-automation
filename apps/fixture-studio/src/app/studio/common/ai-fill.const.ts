import type { AI_PROGRESS_STREAMS, AI_TOOLS } from '@fixture-automation/fixture-studio-api/contract';

import type { AiAvailability, AiFillForm } from './ai-fill.type.ts';

/** The progress log keeps only the latest lines so a chatty CLI can't grow the DOM without bound. */
export const AI_LOG_LIMIT = 400;

/** One streamed answer keeps only its last 64 KiB in the log, so a huge answer can't bloat the DOM. */
export const AI_LOG_BLOCK_LIMIT = 64 * 1024;

/**
 * Largest trimmed prompt the on-device model is offered for: about 4 prompts at 75% of Nano's 9,216-token window,
 * ~3.7 characters per token (README "Chrome AI limits"). Past it a fill needs many slow chunks or cannot split at all.
 */
export const ON_DEVICE_PROMPT_BYTE_LIMIT = 100_000;

export const AI_OPT_IN_STORAGE_KEY = 'fixture-studio.use-chrome-ai';

export const DEFAULT_AI_FILL_FORM: AiFillForm = {
  scenario: '',
  tool: 'claude',
  model: ''
};

export const AI_AVAILABILITY_LABELS: Record<AiAvailability, string> = {
  available: 'Ready',
  downloadable: 'Model not downloaded yet',
  downloading: 'Downloading the model',
  unavailable: 'Not available in this browser'
};

/** The CLIs the API can drive: the contract's `AI_TOOLS` (a copy, drift-checked by its type). */
export const CLI_TOOLS: typeof AI_TOOLS = ['claude', 'codex', 'antigravity', 'copilot', 'gemini'];

/** The contract's `AI_PROGRESS_STREAMS` (a copy, drift-checked by its type). */
export const FILL_PROGRESS_STREAMS: typeof AI_PROGRESS_STREAMS = ['stdout', 'stderr', 'status'];
