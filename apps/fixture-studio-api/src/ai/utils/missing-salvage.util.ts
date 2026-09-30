import { isListFill, missingCheck, pathTree, valueAtPath, violatedPaths } from '@fixture-automation/openapi-ai-fixtures';
import type { PathValue } from '@fixture-automation/openapi-ai-fixtures';

import { normalizedAnswer } from './answer-shape.util.ts';
import { sampleAtPath } from './fill-path.util.ts';
import { missingSample } from './missing-sample.util.ts';
import { salvageNote } from './salvage-note.util.ts';
import type { FillSource, MissingFile } from '../../contract/common/studio-api.type.ts';
import type { FillOutcome } from '../common/ai.type.ts';

type SourcedValue = {
  readonly path: string;
  readonly value: unknown;
  readonly source: FillSource;
};

/** The missing paths the projection rejects when only `entries` are filled. */
type FillCheck = (entries: PathValue[]) => Set<string>;

const isPresent = (entry: PathValue): boolean => entry.value !== undefined;

const sourced = (path: string, value: unknown, source: FillSource): SourcedValue => {
  const entry: SourcedValue = { path, value, source };

  return entry;
};

const fillCheck = (missing: MissingFile): FillCheck => {
  const judge = missingCheck(missing);
  const isList = isListFill(missing.paths);

  const check: FillCheck = (entries: PathValue[]): Set<string> => {
    const tree = pathTree(entries, isList);
    const verdict = judge(tree);

    return violatedPaths(verdict.errors, missing.paths);
  };

  return check;
};

/** The answer's values at missing paths, each only when it passes the projection. */
const validAnswerValues = (candidate: unknown, missing: MissingFile, check: FillCheck): SourcedValue[] => {
  const answer = normalizedAnswer(candidate, missing);
  const entryAt = (path: string): SourcedValue => sourced(path, valueAtPath(answer, path), 'ai');
  const present = missing.paths.map(entryAt).filter(isPresent);
  const invalid = check(present);

  return present.filter((entry: SourcedValue): boolean => !invalid.has(entry.path));
};

/** The valid values of the answer with the most of them; a tie goes to the later answer, the repair. */
const bestAnswerValues = (candidates: unknown[], missing: MissingFile, check: FillCheck): Map<string, SourcedValue> => {
  let best: SourcedValue[] = [];

  for (const candidate of candidates) {
    const values = validAnswerValues(candidate, missing, check);

    if (values.length >= best.length) best = values;
  }

  const pairs = best.map((entry: SourcedValue): [string, SourcedValue] => [entry.path, entry]);

  return new Map(pairs);
};

/** The sampler's values for the projection, or `undefined` when it cannot sample it (e.g. an external `$ref`). */
const safeSample = (missing: MissingFile): unknown => {
  try {
    return missingSample(missing);
  } catch {
    return undefined;
  }
};

/** What `path` may hold, best first: the model's valid value, then the sampler's. */
const optionsFor = (path: string, answers: Map<string, SourcedValue>, sample: unknown): SourcedValue[] => {
  const answered = answers.get(path);
  const sampled = sourced(path, sampleAtPath(sample, path), 'sampler');
  const options: SourcedValue[] = [];

  if (answered !== undefined) options.push(answered);

  options.push(sampled);

  return options.filter(isPresent);
};

/** `kept` plus the first option for one path that leaves every filled path valid, or `kept` when none does. */
const withFirstValid = (kept: SourcedValue[], options: SourcedValue[], check: FillCheck): SourcedValue[] => {
  for (const option of options) {
    const trial = [...kept, option];
    const rejected = check(trial);
    const isAccepted = trial.every((entry: SourcedValue): boolean => !rejected.has(entry.path));

    if (isAccepted) return trial;
  }

  return kept;
};

/**
 * Builds the best fill it can when the model's answers failed: the answer holding the most projection-valid values,
 * reshaped to the projection and trimmed to the missing paths, supplies those values; every other missing path takes
 * the sampler's value for it. A path the projection rejects once they are combined is retried on its own, with the
 * model's value and then the sampler's; one no value fits is left out and reported `unfilled`. The fill is a list for
 * a list fixture. `context` opens the single note, e.g. `Chunk 2 of 3: claude returned text that is not JSON`.
 */
export const missingSalvage = (missing: MissingFile, candidates: unknown[], context: string): FillOutcome => {
  const check = fillCheck(missing);
  const answers = bestAnswerValues(candidates, missing, check);
  const sample = safeSample(missing);
  const choices = missing.paths.map((path: string): SourcedValue[] => optionsFor(path, answers, sample));
  const combined = choices.flatMap((options: SourcedValue[]): SourcedValue[] => options.slice(0, 1));
  const rejected = check(combined);
  let kept = combined.filter((entry: SourcedValue): boolean => !rejected.has(entry.path));

  for (const options of choices) {
    const [best] = options;

    if (best === undefined) continue;

    const isRejected = rejected.has(best.path);

    if (isRejected) kept = withFirstValid(kept, options, check);
  }

  const byPath = new Map(kept.map((entry: SourcedValue): [string, SourcedValue] => [entry.path, entry]));
  const keptAt = (path: string): SourcedValue[] => {
    const entry = byPath.get(path);

    if (entry === undefined) return [];

    return [entry];
  };
  const ordered = missing.paths.flatMap(keptAt);
  const sourceAt = (path: string): [string, FillSource] => [path, byPath.get(path)?.source ?? 'unfilled'];
  const sources = Object.fromEntries(missing.paths.map(sourceAt));
  const populated = pathTree(ordered, isListFill(missing.paths));
  const notes = [salvageNote(context, sources)];
  const outcome: FillOutcome = { populated, sources, notes };

  return outcome;
};
