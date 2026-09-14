import { FixtureError, schemaSuggestion } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';

import { fragmentAnchorOwner, schemaAnchors } from './schema-anchor.util.ts';
import { pointerReferenceName, schemaReferences } from './schema-reference.util.ts';
import type { SchemaDialect } from '../common/schema.type.ts';

type SchemaRecord = Record<string, unknown>;

export const schemaGraph = (spec: OpenApiSpec, name: string, dialect: SchemaDialect): SchemaRecord => {
  const schemas = spec.components?.schemas ?? {};
  const hasTarget = Object.hasOwn(schemas, name);

  if (!hasTarget) throw new FixtureError(`schema "${name}" is unavailable`, schemaSuggestion(Object.keys(schemas), name));

  const anchors = schemaAnchors(schemas, dialect);
  const selected = new Map<string, unknown>();
  const pending = [name];

  for (const schemaName of pending) {
    const isSelected = selected.has(schemaName);

    if (isSelected) continue;

    const source = schemas[schemaName];

    if (source === undefined) throw new Error(`unresolved schema reference "${schemaName}"`);

    const cloned = structuredClone(source);

    selected.set(schemaName, cloned);

    const references = schemaReferences(source, dialect);

    for (const reference of references) {
      const isPointer = reference.startsWith('#/');
      let targetName: string | undefined;

      if (isPointer) targetName = pointerReferenceName(reference, spec);
      else targetName = fragmentAnchorOwner(reference, schemaName, anchors, dialect);

      if (targetName !== undefined) pending.push(targetName);
    }
  }

  return Object.fromEntries(selected);
};
