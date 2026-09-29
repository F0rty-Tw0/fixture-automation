import type { DiffResult, MergeResult } from '@fixture-automation/fixture-studio-api/contract';

const plural = (count: number, noun: string): string => {
  const suffix = count === 1 ? '' : 's';

  return `${count} ${noun}${suffix}`;
};

/** The missing values step's status: how many paths are absent and how many present values are broken. */
export const missingStatus = (result: DiffResult | undefined): string => {
  if (result === undefined) return 'Waiting for a compare';

  const absent = result.missingPaths.length - result.replacedPaths.length;

  return `${absent} missing · ${result.broken.length} broken`;
};

/** The AI fill step's status, from nothing to fill, through running, to how the merge validated. */
export const fillStatus = (result: DiffResult | undefined, isRunning: boolean, merge: MergeResult | undefined): string => {
  if (result === undefined) return 'Waiting for missing values';

  const fillCount = result.missingPaths.length;

  if (fillCount === 0) return 'Nothing to fill';

  if (isRunning) return 'Filling…';

  if (merge === undefined) return `${plural(fillCount, 'value')} to fill`;

  if (merge.valid) return 'Merged · valid';

  return `Merged · ${plural(merge.errors.length, 'schema error')}`;
};
