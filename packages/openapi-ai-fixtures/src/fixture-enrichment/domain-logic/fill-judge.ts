import { isRecord } from '@fixture-automation/shared';

import type { AgentJson } from '../../agent-provider/common/agent-provider.type.ts';
import type { MissingPattern } from '../../missing-patterns/common/missing-pattern.type.ts';
import { expandedFill } from '../../missing-patterns/utils/pattern-expand.util.ts';
import type { MissingFile, MissingValidator } from '../../missing-values/common/missing.type.ts';
import { isListFill, isMissingFill } from '../../missing-values/utils/missing-fill.util.ts';
import { violatingErrors } from '../../missing-values/utils/violation-paths.util.ts';
import { validationDetails } from '../../schema/utils/validation-message.util.ts';
import type { FillJudge } from '../common/agent-fixture.type.ts';

const NOT_OBJECT = 'the fill must be one JSON object';
const NOT_LIST = 'the fill must be one JSON array';

const isArrayValue = (value: unknown): boolean => Array.isArray(value);

const isNotArrayValue = (value: unknown): boolean => !Array.isArray(value);

/** Why a value does not fill the projection's shape: a list for a list fill, an object otherwise. */
export const wrongShapeOf = (missing: MissingFile): string => {
  const isList = isListFill(missing.paths);

  return isList ? NOT_LIST : NOT_OBJECT;
};

/** The alternatives worth trying, best first; a list fill tries the lists among them before anything else. */
const preferredAlternatives = (alternatives: unknown[], isList: boolean): unknown[] => {
  if (!isList) return alternatives;

  const lists = alternatives.filter(isArrayValue);
  const others = alternatives.filter(isNotArrayValue);

  return [...lists, ...others];
};

/**
 * The answer as written when expansion changed it and it is an object or list: a concrete answer for a top-level
 * array field (`{ "tags": ["a", "b"] }`) also reads as a pattern answer, which expansion would turn into `"a"`.
 */
const unexpandedAnswer = (value: unknown, fill: unknown): unknown[] => {
  const isExpanded = value !== fill;
  const isContainer = isRecord(value) || Array.isArray(value);
  const isRawFill = isExpanded && isContainer;

  if (!isRawFill) return [];

  return [value];
};

/**
 * Expands each parsed pattern answer to its concrete fill and judges that against the projection, counting only the
 * errors that touch a missing path: sparse indices leave array holes, and the projection's collapsed `items` requires
 * every missing key on every item, neither of which the merge ever writes. When the parser's best-ranked value fails,
 * another JSON value from the same answer that fits is accepted instead, so a correct answer next to a bigger or
 * differently shaped one costs no repair run.
 */
export const fillJudge = (missing: MissingFile, validate: MissingValidator, patterns: MissingPattern[]): FillJudge => {
  const isList = isListFill(missing.paths);
  const wrongShape = wrongShapeOf(missing);
  const candidates: unknown[] = [];
  let accepted: unknown;

  const problemOf = async (value: unknown): Promise<string | undefined> => {
    const verdict = await validate(missing, value);
    const violations = violatingErrors(verdict.errors, missing.paths);
    const isShaped = isMissingFill(value, isList);
    const isUnexplained = !verdict.valid && verdict.errors.length === 0;

    if (violations.length > 0) return validationDetails(violations);

    if (isUnexplained) return verdict.details || wrongShape;

    if (!isShaped) return wrongShape;

    return undefined;
  };

  const expanded = (value: unknown): unknown => expandedFill(value, patterns, isList);

  const check = async (value: unknown, parsed: AgentJson): Promise<string | undefined> => {
    const fill = expanded(value);
    const alternatives = parsed.alternatives.map(expanded);

    candidates.push(...alternatives, fill);

    const problem = await problemOf(fill);

    if (problem === undefined) {
      accepted = fill;

      return undefined;
    }

    const raw = unexpandedAnswer(value, fill);
    const preferred = preferredAlternatives(alternatives, isList);

    for (const alternative of [...raw, ...preferred]) {
      const alternativeProblem = await problemOf(alternative);

      if (alternativeProblem !== undefined) continue;

      accepted = alternative;

      return undefined;
    }

    return problem;
  };
  const judge: FillJudge = { check, candidates, accepted: (): unknown => accepted };

  return judge;
};
