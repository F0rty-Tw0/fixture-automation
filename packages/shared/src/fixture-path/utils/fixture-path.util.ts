import type { PathToken } from '../common/path.type.ts';

const SEGMENT = /^(?=.)([^.[\]]*)((?:\[\d+\])*)$/;
const INDEX = /\[(\d+)\]/g;

/** Split `lines.data[0].id` into its object keys and array indices. */
export const parsePath = (path: string): PathToken[] => {
  const tokens: PathToken[] = [];

  for (const segment of path.split('.')) {
    const match = SEGMENT.exec(segment);
    const key = match?.[1];
    const indexes = match?.[2];
    const isNestedIndex = key === '' && tokens.length > 0;
    const isInvalid = key === undefined || indexes === undefined || isNestedIndex;

    if (isInvalid) throw new Error(`invalid fixture path "${path}"`);

    if (key !== '') tokens.push(key);

    for (const index of indexes.matchAll(INDEX)) tokens.push(Number(index[1]));
  }

  return tokens;
};
