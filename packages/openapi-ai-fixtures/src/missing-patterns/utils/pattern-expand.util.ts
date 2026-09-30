import { isRecord } from '@fixture-automation/shared';

import type { PathValue } from '../../missing-values/common/missing.type.ts';
import { pathTree } from '../../missing-values/utils/path-tree.util.ts';
import type { MissingPattern } from '../common/missing-pattern.type.ts';

const ORDINAL_PLACEHOLDER = '{n}';

type PatternAnswer = Record<string, unknown>;

type ExampleEntry = [string, unknown];

/** A fresh copy of `example` with every `{n}` inside its strings replaced by `ordinal`; keys are kept as written. */
function numberedExample(example: unknown, ordinal: string): unknown {
  if (typeof example === 'string') return example.replaceAll(ORDINAL_PLACEHOLDER, ordinal);

  const numberItem = (item: unknown): unknown => numberedExample(item, ordinal);

  if (Array.isArray(example)) return example.map(numberItem);

  if (!isRecord(example)) return example;

  const numberEntry = ([key, field]: ExampleEntry): ExampleEntry => [key, numberItem(field)];
  const entries = Object.entries(example).map(numberEntry);

  return Object.fromEntries(entries);
}

const examplesOf = (answer: PatternAnswer, pattern: MissingPattern): unknown => {
  const isAnswered = Object.hasOwn(answer, pattern.pattern);

  if (!isAnswered) return undefined;

  return answer[pattern.pattern];
};

/**
 * Whether the answer follows the pattern contract: an object holding at least one pattern key with an array of
 * examples. A top-level pattern such as `status` is also a concrete key, so `{ "status": "open" }` stays concrete.
 */
const isPatternAnswer = (answer: unknown, patterns: MissingPattern[]): answer is PatternAnswer => {
  if (!isRecord(answer)) return false;

  const holdsExamples = (pattern: MissingPattern): boolean => {
    const examples = examplesOf(answer, pattern);

    return Array.isArray(examples);
  };

  return patterns.some(holdsExamples);
};

/**
 * The i-th path of the pattern with example `i % examples.length`, `{n}` as `i + 1`; none without examples.
 * ponytail: K examples reused cyclically; ask per item if repeated values look fake.
 */
const patternValues = (answer: PatternAnswer, pattern: MissingPattern): PathValue[] => {
  const examples = examplesOf(answer, pattern);
  const hasExamples = Array.isArray(examples) && examples.length > 0;

  if (!hasExamples) return [];

  const valueAt = (path: string, index: number): PathValue => {
    const example: unknown = examples[index % examples.length];
    const value = numberedExample(example, String(index + 1));
    const entry: PathValue = { path, value };

    return entry;
  };

  return pattern.paths.map(valueAt);
};

/**
 * The concrete fill a pattern answer (`{ "lines[*].qty": [3, 1] }`) stands for, every path getting its own copy of
 * its example. A pattern without examples leaves its paths absent. Any other answer, including a pattern answer
 * whose patterns hold no example at all, is returned unchanged for the projection to judge: expanding it would give
 * an empty fill, and an empty list passes a list projection.
 */
export const expandedFill = (answer: unknown, patterns: MissingPattern[], isList: boolean): unknown => {
  if (!isPatternAnswer(answer, patterns)) return answer;

  const valuesOf = (pattern: MissingPattern): PathValue[] => patternValues(answer, pattern);
  const entries = patterns.flatMap(valuesOf);

  if (entries.length === 0) return answer;

  return pathTree(entries, isList);
};
