import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';

/** Appends a line and drops the oldest ones beyond `limit`. */
export const appendCapped = (lines: AiFillProgressEvent[], line: AiFillProgressEvent, limit: number): AiFillProgressEvent[] => {
  const appended = [...lines, line];
  const overflow = Math.max(appended.length - limit, 0);

  return appended.slice(overflow);
};
