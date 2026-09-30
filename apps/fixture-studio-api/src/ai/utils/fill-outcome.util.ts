import { isListFill } from '@fixture-automation/openapi-ai-fixtures';
import type { MissingFill } from '@fixture-automation/openapi-ai-fixtures';
import { FixtureError } from '@fixture-automation/openapi-fixtures';

import { mergeAnswers } from './answer-merge.util.ts';
import { pathTree, valueAtPath } from './fill-path.util.ts';
import type { FillSource } from '../../contract/common/studio-api.type.ts';
import type { FillOutcome, PathValue } from '../common/ai.type.ts';

const sourcesOf = (paths: string[], source: FillSource): Record<string, FillSource> => {
  const entries = paths.map((path: string): [string, FillSource] => [path, source]);

  return Object.fromEntries(entries);
};

/** An error's first message line, with its fix when it is a `FixtureError` that has one. */
export const failureText = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error)) return fallback;

  const [firstLine] = error.message.split('\n');
  const message = firstLine ?? error.message;
  const fix = error instanceof FixtureError ? error.fix : undefined;

  if (fix === undefined) return message;

  return `${message} (${fix})`;
};

const answerEntry = (answer: MissingFill, path: string): PathValue => {
  const entry: PathValue = { path, value: valueAtPath(answer, path) };

  return entry;
};

/**
 * A chunk the model answered validly: every one of its paths is the model's. The answer is trimmed to those paths, so
 * the model's padding (`{}` or `null` elements, keys the projection only needed for validation) never reaches a merge.
 */
export const aiOutcome = (paths: string[], answer: MissingFill): FillOutcome => {
  const entries = paths.map((path: string): PathValue => answerEntry(answer, path));
  const present = entries.filter((entry: PathValue): boolean => entry.value !== undefined);
  const populated = pathTree(present, isListFill(paths));
  const sources = sourcesOf(paths, 'ai');
  const outcome: FillOutcome = { populated, sources, notes: [] };

  return outcome;
};

/** A chunk neither the model nor the salvage could fill; the note says why, with the error's fix when it has one. */
export const unfilledOutcome = (paths: string[], context: string, error: unknown): FillOutcome => {
  const sources = sourcesOf(paths, 'unfilled');
  const noun = paths.length === 1 ? 'value' : 'values';
  const note = `${context}; ${paths.length} ${noun} could not be filled: ${failureText(error, 'salvage failed')}.`;
  const populated = pathTree([], isListFill(paths));
  const outcome: FillOutcome = { populated, sources, notes: [note] };

  return outcome;
};

/** Two chunks' outcomes as one: values merged key by key and index by index, sources and notes in chunk order. */
export const mergedOutcome = (first: FillOutcome, second: FillOutcome): FillOutcome => {
  const populated = mergeAnswers(first.populated, second.populated);
  const sources = { ...first.sources, ...second.sources };
  const notes = [...first.notes, ...second.notes];
  const outcome: FillOutcome = { populated, sources, notes };

  return outcome;
};
