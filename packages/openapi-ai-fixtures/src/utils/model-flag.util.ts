import type { AiFixtureOptions } from '../common/ai-fixtures.type.ts';

/** The literal that keeps a harness on its own default model instead of passing a flag. */
export const DEFAULT_MODEL = 'default';

/** The slug an adapter must pass through, or `undefined` when the harness default applies. */
export const selectedModel = (options: AiFixtureOptions): string | undefined => {
  const { model } = options;

  if (model === undefined || model === DEFAULT_MODEL) return undefined;

  return model;
};
