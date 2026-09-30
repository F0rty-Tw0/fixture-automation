import ts from 'typescript';

const isExported = (statement: ts.VariableStatement): boolean => {
  const modifiers = statement.modifiers ?? [];

  return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
};

const declarationsOf = (statements: ts.VariableStatement[]): ts.VariableDeclaration[] => {
  return statements.flatMap((statement) => [...statement.declarationList.declarations]);
};

const firstInitializer = (statements: ts.VariableStatement[]): ts.Expression | undefined => {
  return declarationsOf(statements).find((declaration) => declaration.initializer !== undefined)?.initializer;
};

/** The initializer of the top-level variable called `name`, if this file declares one. */
const declaredValue = (source: ts.SourceFile, name: string): ts.Expression | undefined => {
  const variables = source.statements.filter(ts.isVariableStatement);
  const isNamed = (declaration: ts.VariableDeclaration): boolean =>
    ts.isIdentifier(declaration.name) && declaration.name.text === name;

  return declarationsOf(variables).find(isNamed)?.initializer;
};

/** `export default invoice;` points at a same-file const; anything else is the value itself. */
const defaultExportValue = (source: ts.SourceFile, expression: ts.Expression): ts.Expression => {
  if (!ts.isIdentifier(expression)) return expression;

  return declaredValue(source, expression.text) ?? expression;
};

/** `export default …` (resolved through a same-file const), else the first exported const, else the first const with a value. */
export const fixtureExpression = (source: ts.SourceFile): ts.Expression | undefined => {
  const exportDefault = source.statements.find(ts.isExportAssignment);

  if (exportDefault !== undefined) return defaultExportValue(source, exportDefault.expression);

  const variables = source.statements.filter(ts.isVariableStatement);
  const exported = variables.filter(isExported);

  return firstInitializer(exported) ?? firstInitializer(variables);
};
