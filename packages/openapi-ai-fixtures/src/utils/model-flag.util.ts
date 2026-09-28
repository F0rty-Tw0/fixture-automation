import { FixtureError } from '@fixture-automation/openapi-fixtures';

import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

/** The literal that keeps a harness on its own default model instead of passing a flag. */
export const DEFAULT_MODEL = 'default';

/** The slug an adapter must pass through, or `undefined` when the harness default applies; a leading `-` would read as a CLI flag and is refused. */
export const selectedModel = (options: AiFixtureOptions): string | undefined => {
  const { model } = options;

  if (model === undefined || model === DEFAULT_MODEL) return undefined;

  const looksLikeFlag = model.startsWith('-');

  if (looksLikeFlag) throw new FixtureError(`model "${model}" must not start with "-"`, 'pass the model slug itself, e.g. --model gpt-5');

  return model;
};
