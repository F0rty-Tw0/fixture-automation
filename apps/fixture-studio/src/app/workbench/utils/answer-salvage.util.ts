import type { AiFillResultEvent, FillSource } from '@fixture-automation/fixture-studio-api/contract';

import type { JsonContainer } from '../../shared/json/common/json.type.ts';
import { pathSegments, valueAt, withValueAt } from '../../shared/json/utils/json-path.util.ts';
import { isRecord } from '../../shared/json/utils/record.util.ts';
import type { SalvageSource } from '../common/ai-fill.type.ts';

const unansweredNote = (unanswered: number, total: number): string => {
  return `The on-device model did not answer ${unanswered} of ${total} values; the schema's sample values stand in for them.`;
};

/**
 * The answer as the container to fill, when its root is the same kind as the complete fixture's (list or object);
 * otherwise an empty container of that kind, since a list answering an object fixture (or the reverse) holds nothing
 * `merge` could use.
 */
const answeredRoot = (answer: unknown, complete: unknown): JsonContainer => {
  const isListFixture = Array.isArray(complete);

  if (Array.isArray(answer) && isListFixture) {
    const items: unknown[] = answer;

    return items;
  }

  if (isRecord(answer) && !isListFixture) return answer;

  if (isListFixture) return [];

  const empty: Record<string, unknown> = {};

  return empty;
};

/**
 * The on-device answer made whole: every missing path the model left out takes the schema sampler's value from the
 * complete fixture, so one failed chunk never fails the fill. Each path's source says which it is. A list fixture's
 * answer stays a list, filled item by item through its `[i].x` paths.
 */
export const salvagedAnswer = (answer: unknown, source: SalvageSource, notes: string[]): AiFillResultEvent => {
  let populated = answeredRoot(answer, source.complete);
  const sources: Record<string, FillSource> = {};

  for (const path of source.missing.paths) {
    const segments = pathSegments(path);
    const answered = valueAt(populated, segments);
    const sampled = valueAt(source.complete, segments);

    if (answered !== undefined) {
      sources[path] = 'ai';
    } else if (sampled === undefined) {
      sources[path] = 'unfilled';
    } else {
      populated = withValueAt(populated, segments, sampled);
      sources[path] = 'sampler';
    }
  }

  const total = source.missing.paths.length;
  const unanswered = total - Object.values(sources).filter((fill) => fill === 'ai').length;
  const allNotes = [...notes];

  if (unanswered > 0) allNotes.push(unansweredNote(unanswered, total));

  const result: AiFillResultEvent = { type: 'result', populated, sources, notes: allNotes };

  return result;
};
