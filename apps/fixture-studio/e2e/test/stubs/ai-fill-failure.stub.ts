import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

/** What the UI shows when the `ai-fill` stream closes before a `result` or `error` event; the stream sends no fix. */
export const NO_RESULT_ERROR_STUB: ApiErrorBody = { message: 'The AI fill stream ended without a result.', fix: undefined };
