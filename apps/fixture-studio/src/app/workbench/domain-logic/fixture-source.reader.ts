import type { LiteralParse } from '../common/comparison.type.ts';
import { isScriptSource, parseJsonSource } from '../utils/fixture-source.util.ts';

const looksLikeJson = (text: string): boolean => {
  const start = text.trimStart();

  return start.startsWith('{') || start.startsWith('[');
};

/**
 * Parses an existing fixture in the browser: JSON directly, `.ts`/`.js` (or pasted non-JSON) through a
 * literals-only TypeScript reader. The reader and the TypeScript compiler load on first use, as their own chunk.
 */
export const parseFixtureSource = async (text: string, name: string, isPasted: boolean): Promise<LiteralParse> => {
  const isScript = isScriptSource(name);

  if (!isScript) {
    const json = parseJsonSource(text, name);
    const canTryScript = isPasted && json.kind === 'error';

    if (!canTryScript) return json;
  }

  const { readTsLiteral } = await import('../utils/ts-literal.util.ts');
  const source = isPasted && looksLikeJson(text) ? `export default (${text});` : text;

  return readTsLiteral(source, name);
};
