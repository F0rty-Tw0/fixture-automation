import ts from 'typescript';

import { readLiteral, rejectedLiteral } from './fixture-source.util.ts';
import { fixtureExpression } from './ts-literal.export.util.ts';
import type { LiteralParse } from '../common/comparison.type.ts';

/** Reads a nested value; passed down so arrays and objects can recurse without forward references. */
type LiteralReader = (expression: ts.Expression, source: ts.SourceFile) => LiteralParse;

type TypeWrapper = ts.AsExpression | ts.ParenthesizedExpression | ts.SatisfiesExpression | ts.TypeAssertion;

const isTypeWrapper = (node: ts.Expression): node is TypeWrapper => {
  const isCast = ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
  const isWrapped = ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node);

  return isCast || isWrapped;
};

/** Strips `( … )`, `as T`, `as const`, `satisfies T` and `<T>` down to the value expression. */
const unwrapped = (node: ts.Expression): ts.Expression => {
  let current = node;

  while (isTypeWrapper(current)) current = current.expression;

  return current;
};

const describe = (node: ts.Node): string => {
  if (ts.isIdentifier(node)) return `the identifier "${node.text}"`;

  if (ts.isCallExpression(node)) return 'a function call';

  if (ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) return 'a spread';

  if (ts.isTemplateExpression(node)) return 'a template with ${…}';

  if (ts.isShorthandPropertyAssignment(node)) return `the shorthand property "${node.name.text}"`;

  if (ts.isComputedPropertyName(node)) return 'a computed property name';

  return `a ${ts.SyntaxKind[node.kind]}`;
};

const rejected = (node: ts.Node, source: ts.SourceFile): LiteralParse => {
  const start = node.getStart(source);
  const { line } = source.getLineAndCharacterOfPosition(start);

  return rejectedLiteral(`Line ${line + 1}: ${describe(node)} can't be read without running the file; use plain literals.`);
};

const propertyKey = (name: ts.PropertyName): string | undefined => {
  const hasText = ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name);

  return hasText ? name.text : undefined;
};

const arrayValue = (node: ts.ArrayLiteralExpression, source: ts.SourceFile, read: LiteralReader): LiteralParse => {
  const items: unknown[] = [];

  for (const element of node.elements) {
    const item = read(element, source);

    if (item.kind === 'error') return item;

    items.push(item.value);
  }

  return readLiteral(items);
};

const objectValue = (node: ts.ObjectLiteralExpression, source: ts.SourceFile, read: LiteralReader): LiteralParse => {
  const entries: Record<string, unknown> = {};

  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) return rejected(property, source);

    const key = propertyKey(property.name);

    if (key === undefined) return rejected(property.name, source);

    const entry = read(property.initializer, source);

    if (entry.kind === 'error') return entry;

    const descriptor: PropertyDescriptor = { value: entry.value, enumerable: true, writable: true, configurable: true };

    // An own property, like JSON.parse makes: assigning a `__proto__` key would swap the prototype and drop the key.
    Object.defineProperty(entries, key, descriptor);
  }

  return readLiteral(entries);
};

const scalarValue = (node: ts.Expression, source: ts.SourceFile): LiteralParse => {
  if (ts.isStringLiteralLike(node)) return readLiteral(node.text);

  if (ts.isNumericLiteral(node)) return readLiteral(Number(node.text));

  if (node.kind === ts.SyntaxKind.TrueKeyword) return readLiteral(true);

  if (node.kind === ts.SyntaxKind.FalseKeyword) return readLiteral(false);

  if (node.kind === ts.SyntaxKind.NullKeyword) return readLiteral(null);

  const isNegative = ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken;

  if (isNegative && ts.isNumericLiteral(node.operand)) return readLiteral(-Number(node.operand.text));

  return rejected(node, source);
};

const literalValue: LiteralReader = (expression, source) => {
  const node = unwrapped(expression);

  if (ts.isArrayLiteralExpression(node)) return arrayValue(node, source, literalValue);

  if (ts.isObjectLiteralExpression(node)) return objectValue(node, source, literalValue);

  return scalarValue(node, source);
};

/**
 * Reads a fixture's value from TypeScript source without running it: only object, array,
 * string, number (incl. negative), boolean and null literals are accepted.
 */
export const readTsLiteral = (text: string, name: string): LiteralParse => {
  const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const expression = fixtureExpression(source);

  if (expression === undefined) return rejectedLiteral(`${name} has no \`export const\` or \`export default\` with a value.`);

  return literalValue(expression, source);
};
