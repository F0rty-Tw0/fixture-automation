import { isRecord } from '@fixture-automation/shared';

type RankedJson = {
  readonly value: unknown;
  readonly key: string;
  readonly kind: number;
  readonly size: number;
};

type IndexedText = {
  readonly text: string;
  readonly index: number;
};

const ANY_CODE_FENCE = /```[^\n`]*\r?\n([\s\S]*?)```/gu;
/** The best value and 8 alternatives: enough for a salvage to score, few enough to validate each one. */
const MAX_VALUES = 9;
/** The longest texts parsed; a bigger answer ranks first, so a flood of tiny spans (`[0] [1] …`) is only noise. */
const MAX_PARSED = 256;

const jsonValue = (_key: string, value: unknown): unknown => {
  if (typeof value !== 'number') return value;

  const isFinite = Number.isFinite(value);

  if (!isFinite) throw new Error('JSON number exceeds the finite JavaScript range');

  return value;
};

/** Strict JSON parsing that rejects a number beyond the finite range instead of turning it into `Infinity`. */
export const finiteJson = (text: string): unknown => {
  const value: unknown = JSON.parse(text, jsonValue);

  return value;
};

const fenceBody = (match: RegExpExecArray): string => match[1] ?? '';

const openingBracket = (character: string): string | undefined => {
  if (character === '}') return '{';

  if (character === ']') return '[';

  return undefined;
};

/** Index of the quote closing the JSON string opened at `quote`, or the text length when it never closes. */
const stringEnd = (text: string, quote: number): number => {
  for (let index = quote + 1; index < text.length; index += 1) {
    const character = text.charAt(index);

    if (character === '\\') index += 1;
    else if (character === '"') return index;
  }

  return text.length;
};

/** Every top-level balanced `{...}` or `[...]` span in `text`; brackets inside JSON strings are skipped. */
const bracketSpans = (text: string): string[] => {
  const spans: string[] = [];
  const open: string[] = [];
  let start = 0;

  const close = (character: string, index: number): void => {
    const opening = openingBracket(character);

    if (opening === undefined) return;

    const innermost = open.at(-1);
    const isMatch = innermost === opening;

    if (!isMatch) {
      open.length = 0;

      return;
    }

    open.pop();

    if (open.length === 0) spans.push(text.slice(start, index + 1));
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    const isOpening = character === '{' || character === '[';
    const isQuote = character === '"' && open.length > 0;

    if (isQuote) {
      index = stringEnd(text, index);
    } else if (isOpening) {
      if (open.length === 0) start = index;

      open.push(character);
    } else if (open.length > 0) {
      close(character, index);
    }
  }

  return spans;
};

/** How many JSON values `value` holds, itself included: its structural size. */
function nodeCount(value: unknown): number {
  const isContainer = Array.isArray(value) || isRecord(value);

  if (!isContainer) return 1;

  const children: unknown[] = Object.values(value);

  return children.reduce((total: number, child: unknown): number => total + nodeCount(child), 1);
}

/** 2 for an object, 1 for a list, 0 for a scalar: an answer is an object far more often than a bare list. */
const kindOf = (value: unknown): number => {
  if (Array.isArray(value)) return 1;

  return isRecord(value) ? 2 : 0;
};

const rankedCandidate = (text: string): RankedJson[] => {
  try {
    const value = finiteJson(text);
    const size = nodeCount(value);
    const kind = kindOf(value);
    const isEmpty = size === 1 && kind > 0;

    if (isEmpty) return [];

    const ranked: RankedJson = { value, key: JSON.stringify(value), kind, size };

    return [ranked];
  } catch {
    return [];
  }
};

const byBest = (first: RankedJson, second: RankedJson): number => second.kind - first.kind || second.size - first.size;

const indexedText = (text: string, index: number): IndexedText => {
  const indexed: IndexedText = { text, index };

  return indexed;
};

/** The `MAX_PARSED` longest texts, back in their original order so a tie still goes to the earlier one. */
const longestTexts = (texts: string[]): string[] => {
  const indexed = texts.map(indexedText);
  const longest = indexed.toSorted((first, second): number => second.text.length - first.text.length).slice(0, MAX_PARSED);
  const ordered = longest.toSorted((first, second): number => first.index - second.index);

  return ordered.map((entry: IndexedText): string => entry.text);
};

/**
 * The non-empty JSON values a model wrapped in prose or Markdown, best first: every fenced block (any language label)
 * and every top-level balanced `{...}`/`[...]` span, objects before lists before scalars, larger before smaller, and
 * fenced blocks before spans and then earlier before later on a tie. A value found twice, e.g. in a fence and as a span,
 * is listed once. Only the longest `MAX_PARSED` texts are parsed and at most `MAX_VALUES` values returned, so a response
 * flooded with spans stays cheap to parse here and to validate later.
 */
export const recoveredJson = (text: string): unknown[] => {
  const fenced = Array.from(text.matchAll(ANY_CODE_FENCE), fenceBody);
  const spans = bracketSpans(text);
  const texts = longestTexts([...fenced, ...spans]);
  const ranked = texts.flatMap(rankedCandidate).toSorted(byBest);
  const seen = new Set<string>();
  const values: unknown[] = [];

  for (const candidate of ranked) {
    const isSeen = seen.has(candidate.key);

    if (isSeen) continue;

    seen.add(candidate.key);
    values.push(candidate.value);

    if (values.length === MAX_VALUES) break;
  }

  return values;
};
