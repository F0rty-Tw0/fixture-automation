import { isRecord } from '@fixture-automation/shared';

const NAME_MAPS = ['$defs', 'definitions', 'dependentSchemas', 'patternProperties', 'properties'];

/** Every `$ref` string in a schema tree, parents before children. */
export function schemaReferences(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(schemaReferences);

  if (!isRecord(value)) return [];

  const children = Object.values(value).flatMap(schemaReferences);
  const reference = value['$ref'];

  if (typeof reference !== 'string') return children;

  return [reference, ...children];
}

const nestedSchemas = (key: string, child: unknown): unknown[] => {
  const isNameMapKey = NAME_MAPS.includes(key);

  if (isNameMapKey && isRecord(child)) return Object.values(child);

  return [child];
};

/** Every keyword used anywhere in a schema tree; property and definition names are not keywords and are skipped. */
export function schemaKeywords(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(schemaKeywords);

  if (!isRecord(value)) return [];

  const keywords: string[] = [];

  for (const [key, child] of Object.entries(value)) {
    const nested = nestedSchemas(key, child);
    const nestedKeywords = nested.flatMap(schemaKeywords);

    keywords.push(key, ...nestedKeywords);
  }

  return keywords;
}
