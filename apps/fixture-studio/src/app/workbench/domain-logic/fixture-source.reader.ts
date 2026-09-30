import type { LiteralParse } from '../common/comparison.type.ts';
import { isScriptSource, parseJsonSource } from '../utils/fixture-source.util.ts';

const looksLikeJson = (text: string): boolean => {
  const start = text.trimStart();

  return start.startsWith('{') || start.startsWith('[');
};

/** The literals-only TypeScript reader; it and the TypeScript compiler load on first use, as their own chunk. */
const readLiteralSource = async (source: string, name: string): Promise<LiteralParse> => {
  const { readTsLiteral } = await import('../utils/ts-literal.util.ts');

  return readTsLiteral(source, name);
};

/**
 * Parses an existing fixture in the browser: JSON directly, `.ts`/`.js` through a literals-only TypeScript reader.
 * JSON that does not parse (trailing commas, comments, unquoted keys) is read as an object literal too, whether pasted
 * or dropped as a `.json` file; pasted non-JSON is read as TypeScript source. A `.json` file neither reader accepts
 * keeps the JSON error, which names the file.
 */
export const parseFixtureSource = async (text: string, name: string, isPasted: boolean): Promise<LiteralParse> => {
  const isScript = isScriptSource(name);

  if (isScript) return readLiteralSource(text, name);

  const json = parseJsonSource(text, name);
  const isJsonLike = looksLikeJson(text);
  const isLiteralCandidate = isPasted || isJsonLike;

  if (json.kind === 'value' || !isLiteralCandidate) return json;

  const source = isJsonLike ? `export default (${text});` : text;
  const literal = await readLiteralSource(source, name);
  const isRead = literal.kind === 'value';

  if (isRead || isPasted) return literal;

  return json;
};
