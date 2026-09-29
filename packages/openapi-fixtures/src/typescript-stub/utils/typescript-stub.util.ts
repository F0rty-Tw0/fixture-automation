export const typescriptStub = (schemaName: string, typesImport: string, json: string): string => {
  const separatedName = schemaName.replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2');
  const acronymName = separatedName.replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1_$2');
  const identifier = acronymName.replaceAll(/[^a-zA-Z0-9]+/g, '_');
  const trimmedIdentifier = identifier.replaceAll(/^_+|_+$/g, '');
  let name = trimmedIdentifier.toUpperCase() || 'SCHEMA';
  const startsWithDigit = /^[0-9]/.test(name);

  if (startsWithDigit) {
    name = `SCHEMA_${name}`;
  }

  const moduleSpecifier = JSON.stringify(typesImport);
  const schemaKey = JSON.stringify(schemaName);
  const literal = json.replaceAll(/^(\s*)"__proto__":/gm, '$1["__proto__"]:');
  const source = `import type { components } from ${moduleSpecifier};\n\nexport const ${name}_STUB: components["schemas"][${schemaKey}] = ${literal};\n`;

  return source;
};
