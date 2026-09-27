import type { AI_PROGRESS_STREAMS, AI_TOOLS } from '@fixture-automation/fixture-studio-api/contract';

import type { AiAvailability, AiFillForm } from './ai-fill.type.ts';

/** The progress log keeps only the latest lines so a chatty CLI can't grow the DOM without bound. */
export const AI_LOG_LIMIT = 400;

export const AI_OPT_IN_STORAGE_KEY = 'fixture-studio.use-chrome-ai';

export const DEFAULT_AI_FILL_FORM: AiFillForm = {
  scenario: '',
  tool: 'claude',
  model: ''
};

export const AI_AVAILABILITY_LABELS: Record<AiAvailability, string> = {
  available: 'Ready',
  downloadable: 'Downloads the model on first run',
  downloading: 'Downloading the model',
  unavailable: 'Not available in this browser'
};

/** The CLIs the API can drive: the contract's `AI_TOOLS` (a copy, drift-checked by its type). */
export const CLI_TOOLS: typeof AI_TOOLS = ['claude', 'codex', 'antigravity', 'copilot', 'gemini'];

/** The contract's `AI_PROGRESS_STREAMS` (a copy, drift-checked by its type). */
export const FILL_PROGRESS_STREAMS: typeof AI_PROGRESS_STREAMS = ['stdout', 'stderr', 'status'];
