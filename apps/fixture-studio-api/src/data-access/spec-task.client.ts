import { missingCheck } from '@fixture-automation/openapi-ai-fixtures';
import type { MissingVerdict } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { generateFixtures } from './fixture-generation.client.ts';
import type { SpecTask, SpecTaskOutcome, ValidateMissingTask } from '../common/studio-server.type.ts';
import { fixtureDiffResult } from '../utils/fixture-diff-result.util.ts';
import { fixtureMergeResult } from '../utils/fixture-merge-result.util.ts';

const missingVerdict = (task: ValidateMissingTask): MissingVerdict => {
  const check = missingCheck(task.missing);

  return check(task.value);
};

const taskValue = async (task: SpecTask): Promise<unknown> => {
  switch (task.name) {
    case 'generate':
      return generateFixtures(task.spec, task.body);
    case 'diff':
      return fixtureDiffResult(task.spec, task.schemaName, task.body);
    case 'merge':
      return fixtureMergeResult(task.spec, task.schemaName, task.body);
    case 'validate-missing':
      return missingVerdict(task);
  }
};

/** An error thrown with an empty message still reports its name, so the API never answers with a blank reason. */
const failureMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return 'spec task failed';

  if (error.message) return error.message;

  return error.name;
};

const failureOutcome = (error: unknown): SpecTaskOutcome => {
  const isFixtureError = error instanceof FixtureError;
  const message = failureMessage(error);
  const fix = isFixtureError ? error.fix : undefined;
  const outcome: SpecTaskOutcome = { ok: false, message, fix, isFixtureError };

  return outcome;
};

/**
 * Runs one spec task and reports it as a structured-clone-safe outcome, which is what a spec worker posts back.
 */
export const runSpecTask = async (task: SpecTask): Promise<SpecTaskOutcome> => {
  try {
    const value = await taskValue(task);
    const outcome: SpecTaskOutcome = { ok: true, value };

    return outcome;
  } catch (error: unknown) {
    return failureOutcome(error);
  }
};
