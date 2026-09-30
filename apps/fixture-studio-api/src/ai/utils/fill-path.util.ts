import { valueAtTokens } from '@fixture-automation/openapi-ai-fixtures';
import { parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

const pointerToken = (token: PathToken): string => {
  const text = String(token);

  return `/${text.replaceAll('~', '~0').replaceAll('/', '~1')}`;
};

const firstIndex = (token: PathToken): PathToken => (typeof token === 'number' ? 0 : token);

/** `lines[2].quantity` as the JSON pointer `/lines/2/quantity` AJV reports. */
export const pathPointer = (path: string): string => {
  const tokens = parsePath(path);

  return tokens.map(pointerToken).join('');
};

/** The sampler's value for a diff path: the sampler builds one element per array, so every index reads element 0. */
export const sampleAtPath = (sample: unknown, path: string): unknown => {
  const tokens = parsePath(path).map(firstIndex);

  return valueAtTokens(sample, tokens);
};
