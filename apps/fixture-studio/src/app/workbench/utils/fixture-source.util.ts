import type { LiteralParse } from '../common/comparison.type.ts';

const TYPESCRIPT_SOURCE = /\.(?:[cm]?ts|tsx|[cm]?js|jsx)$/iu;

export const rejectedLiteral = (message: string): LiteralParse => {
  const parse: LiteralParse = { kind: 'error', message };

  return parse;
};

export const readLiteral = (value: unknown): LiteralParse => {
  const parse: LiteralParse = { kind: 'value', value };

  return parse;
};

/** `.ts` / `.js` style names are read as TypeScript literals; everything else as JSON. */
export const isScriptSource = (name: string): boolean => {
  return TYPESCRIPT_SOURCE.test(name);
};

/** Parses JSON text; the error names the source so the user knows which input failed. */
export const parseJsonSource = (text: string, name: string): LiteralParse => {
  try {
    return readLiteral(JSON.parse(text));
  } catch {
    return rejectedLiteral(`${name} is not valid JSON.`);
  }
};

/** 2-space JSON with a final newline, like the API's `completeJson` and `mergedJson`, so diffs line up. */
export const prettyJson = (value: unknown): string => {
  return `${JSON.stringify(value, null, 2)}\n`;
};
