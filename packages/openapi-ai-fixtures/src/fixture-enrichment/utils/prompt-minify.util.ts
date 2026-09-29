import { isSchemaRecord } from '../../schema/utils/schema-record.util.ts';

const WHITESPACE_RUNS = /\s+/g;
/** Schema prose a model reads but never has to reproduce. */
const PROSE_KEYWORDS = ['description', 'title'];
/** Keywords whose value is data the fill must match exactly, so nothing inside them is touched. */
const DATA_KEYWORDS = ['const', 'default', 'enum', 'example', 'examples'];

const collapsed = (text: string): string => text.replace(WHITESPACE_RUNS, ' ').trim();

/** Every string inside `value` with whitespace runs collapsed to one space and trimmed; keys and non-strings are kept. */
export function minifiedStrings(value: unknown): unknown {
  if (typeof value === 'string') return collapsed(value);

  if (Array.isArray(value)) return value.map(minifiedStrings);

  if (!isSchemaRecord(value)) return value;

  const entries = Object.entries(value).map(([key, field]: [string, unknown]): [string, unknown] => [key, minifiedStrings(field)]);

  return Object.fromEntries(entries);
}

type ProseWalk = (value: unknown) => unknown;

type SchemaEntry = [string, unknown];

const minifiedEntry = ([key, field]: SchemaEntry, walk: ProseWalk): SchemaEntry => {
  const isData = DATA_KEYWORDS.includes(key);
  const isProse = PROSE_KEYWORDS.includes(key);

  if (isData) return [key, field];

  if (isProse && typeof field === 'string') return [key, collapsed(field)];

  return [key, walk(field)];
};

/**
 * The schema document with whitespace collapsed only inside `description` and `title` strings. `pattern`, `format`,
 * property names and every other string stay as written, and `const`/`default`/`enum`/`example(s)` values are
 * never entered.
 */
export function minifiedSchemaProse(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(minifiedSchemaProse);

  if (!isSchemaRecord(value)) return value;

  const minifyEntry = (entry: SchemaEntry): SchemaEntry => minifiedEntry(entry, minifiedSchemaProse);
  const entries = Object.entries(value).map(minifyEntry);

  return Object.fromEntries(entries);
}
