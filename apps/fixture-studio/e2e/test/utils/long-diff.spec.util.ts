import type { BrokenValue, DiffResult } from '@fixture-automation/fixture-studio-api/contract';

import { DIFF_RESULT_STUB, MISSING_FILE_STUB } from '../stubs/workbench.stub.ts';

/** Each path under its own top-level key, so the missing list has as many folded groups as paths. */
const missingPathAt = (_value: unknown, index: number): string => `section_${index}.value`;

const brokenAt = (_value: unknown, index: number): BrokenValue => {
  const broken: BrokenValue = { path: `lines[${index}]`, value: 'string', reason: 'openapi-sampler placeholder' };

  return broken;
};

const pathOf = (broken: BrokenValue): string => broken.path;

/** A diff with `missingCount` absent paths and `brokenCount` placeholder values, each broken one also refilled. */
export const longDiff = (missingCount: number, brokenCount: number): DiffResult => {
  const paths = Array.from({ length: missingCount }, missingPathAt);
  const broken = Array.from({ length: brokenCount }, brokenAt);
  const replacedPaths = broken.map(pathOf);
  const missing = { ...MISSING_FILE_STUB, paths };
  const diff: DiffResult = { ...DIFF_RESULT_STUB, missing, missingPaths: [...paths, ...replacedPaths], replacedPaths, broken };

  return diff;
};
