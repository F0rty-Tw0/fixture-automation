import { schemaChildren } from './schema-children.util.ts';
import { isSchemaRecord } from './schema-record.util.ts';
import type { SchemaAnchorOwner, SchemaAnchorOwners, SchemaDialect } from '../common/schema.type.ts';

type SchemaAnchor = {
  readonly isDocumentResource: boolean;
  readonly name: string;
};

const hasNamedResource = (identifier: unknown): boolean => {
  if (typeof identifier !== 'string' || identifier.length === 0) return false;

  return !identifier.startsWith('#');
};

const declaredAnchors = (schema: Record<string, unknown>, dialect: SchemaDialect): string[] => {
  const values = [schema['$anchor'], schema['$dynamicAnchor']];
  const names = values.filter((value): value is string => typeof value === 'string');
  const identifier = schema['$id'];

  if (dialect !== 'draft-07' || typeof identifier !== 'string') return names;

  const isFragment = identifier.startsWith('#');

  if (isFragment) names.push(identifier.slice(1));

  return names;
};

const anchorsIn = (schema: unknown, dialect: SchemaDialect, isDocumentResource: boolean): SchemaAnchor[] => {
  if (!isSchemaRecord(schema)) return [];

  const reference = schema['$ref'];
  const ignoresReferenceSiblings = dialect !== 'openapi-31' && typeof reference === 'string';

  if (ignoresReferenceSiblings) return [];

  const isNamedResource = hasNamedResource(schema['$id']);
  const belongsToDocument = isDocumentResource && !isNamedResource;
  const names = declaredAnchors(schema, dialect);
  const anchors = names.map((name): SchemaAnchor => {
    const anchor: SchemaAnchor = { isDocumentResource: belongsToDocument, name };

    return anchor;
  });

  for (const child of schemaChildren(schema)) {
    const childAnchors = anchorsIn(child, dialect, belongsToDocument);

    anchors.push(...childAnchors);
  }

  return anchors;
};

const newAnchorOwner = (): SchemaAnchorOwner => {
  const owner: SchemaAnchorOwner = { documentOwners: [], owners: [] };

  return owner;
};

export const schemaAnchors = (schemas: Record<string, unknown>, dialect: SchemaDialect): SchemaAnchorOwners => {
  const owners: SchemaAnchorOwners = new Map<string, SchemaAnchorOwner>();

  if (dialect === 'openapi-30') return owners;

  for (const [schemaName, schema] of Object.entries(schemas)) {
    const anchors = anchorsIn(schema, dialect, true);

    for (const anchor of anchors) {
      const anchorOwner = owners.get(anchor.name);
      const owner = anchorOwner ?? newAnchorOwner();

      owner.owners.push(schemaName);

      if (anchor.isDocumentResource) owner.documentOwners.push(schemaName);

      owners.set(anchor.name, owner);
    }
  }

  return owners;
};

export const fragmentAnchorOwner = (
  reference: string,
  sourceName: string,
  anchors: SchemaAnchorOwners,
  dialect: SchemaDialect
): string | undefined => {
  if (reference === '#') return undefined;

  const isFragment = reference.startsWith('#');

  if (!isFragment) throw new Error(`external schema reference "${reference}" is not supported`);

  if (dialect === 'openapi-30') throw new Error(`unsupported local schema reference "${reference}"`);

  const fragment = reference.slice(1);
  let anchor: string;

  try {
    anchor = decodeURIComponent(fragment);
  } catch {
    throw new Error(`invalid schema reference "${reference}"`);
  }

  const owner = anchors.get(anchor);

  if (owner === undefined) throw new Error(`unresolved local schema anchor "${reference}"`);

  const isCurrentResource = owner.owners.includes(sourceName);

  if (isCurrentResource) return undefined;

  if (owner.documentOwners.length !== 1) throw new Error(`ambiguous local schema anchor "${reference}"`);

  return owner.documentOwners[0];
};
