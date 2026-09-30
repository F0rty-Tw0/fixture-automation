import { valueAtTokens } from '@fixture-automation/openapi-ai-fixtures';
import { parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

const firstIndex = (token: PathToken): PathToken => (typeof token === 'number' ? 0 : token);

/** The sampler's value for a diff path: the sampler builds one element per array, so every index reads element 0. */
export const sampleAtPath = (sample: unknown, path: string): unknown => {
  const tokens = parsePath(path).map(firstIndex);

  return valueAtTokens(sample, tokens);
};
