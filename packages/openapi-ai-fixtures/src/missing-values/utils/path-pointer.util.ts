import { parsePath } from '@fixture-automation/shared';
import type { PathToken } from '@fixture-automation/shared';

const pointerToken = (token: PathToken): string => {
  const text = String(token);

  return `/${text.replaceAll('~', '~0').replaceAll('/', '~1')}`;
};

/** `lines[2].quantity` as the JSON pointer `/lines/2/quantity` AJV reports. */
export const pathPointer = (path: string): string => {
  const tokens = parsePath(path);

  return tokens.map(pointerToken).join('');
};
