import type { AiFillEvent, AiFillResultEvent, AiProgressStream, FillSource } from '@fixture-automation/fixture-studio-api/contract';

import { parseJsonOrUndefined } from '../../json/utils/json.util.ts';
import { isRecord } from '../../json/utils/record.util.ts';
import { FILL_PROGRESS_STREAMS, FILL_SOURCES } from '../common/studio-api.const.ts';

type NdjsonSplit = {
  /** Complete, non-empty lines. */
  readonly lines: string[];
  /** The trailing partial line, kept until the next chunk completes it. */
  readonly rest: string;
};

/** Splits buffered NDJSON text into complete lines; a line cut by a chunk boundary stays in `rest`. */
export const splitNdjson = (buffer: string): NdjsonSplit => {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  const trimmed = parts.map((line) => line.trim());
  const lines = trimmed.filter((line) => line !== '');
  const split: NdjsonSplit = { lines, rest };

  return split;
};

const isFillSource = (value: unknown): value is FillSource => FILL_SOURCES.some((source) => source === value);

const isSourceEntry = (entry: [string, unknown]): entry is [string, FillSource] => isFillSource(entry[1]);

const isNote = (note: unknown): note is string => typeof note === 'string';

/** `sources` and `notes` are kept only when sent, minus malformed entries: absent sources mean every value is the model's. */
const resultEventOf = (value: Record<string, unknown>): AiFillEvent | undefined => {
  const { populated, sources, notes } = value;
  const isPopulated = isRecord(populated) || Array.isArray(populated);

  if (!isPopulated) return undefined;

  let result: AiFillResultEvent = { type: 'result', populated };

  if (isRecord(sources)) {
    const entries = Object.entries(sources).filter(isSourceEntry);

    result = { ...result, sources: Object.fromEntries(entries) };
  }

  if (Array.isArray(notes)) result = { ...result, notes: notes.filter(isNote) };

  return result;
};

const errorEventOf = (value: Record<string, unknown>): AiFillEvent | undefined => {
  const message = value['message'];
  const fix = value['fix'];

  if (typeof message !== 'string') return undefined;

  const fixLine = typeof fix === 'string' ? fix : undefined;
  const failure: AiFillEvent = { type: 'error', message, fix: fixLine };

  return failure;
};

const isProgressStream = (value: unknown): value is AiProgressStream => FILL_PROGRESS_STREAMS.some((stream) => stream === value);

const progressEventOf = (value: Record<string, unknown>): AiFillEvent | undefined => {
  const stream = value['stream'];
  const text = value['text'];

  if (!isProgressStream(stream)) return undefined;

  if (typeof text !== 'string') return undefined;

  const progress: AiFillEvent = { type: 'progress', stream, text };

  return progress;
};

/** One `ai-fill` event, or `undefined` for a line that is not a well-formed event. */
export const parseFillEvent = (line: string): AiFillEvent | undefined => {
  const value = parseJsonOrUndefined(line);

  if (!isRecord(value)) return undefined;

  switch (value['type']) {
    case 'result':
      return resultEventOf(value);
    case 'error':
      return errorEventOf(value);
    case 'progress':
      return progressEventOf(value);
    default:
      return undefined;
  }
};
