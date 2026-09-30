import { isRecord } from '@fixture-automation/shared';
import type { JSONSchema7 } from 'json-schema';

import { unresolvedReferenceFix } from './schema-reference.util.ts';
import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';
import type { ReferenceTarget } from '../common/schema.type.ts';

const SCHEMA_POINTER = '#/components/schemas/';

const isJsonSchema = (value: unknown): value is JSONSchema7 => isRecord(value);

const unescapeToken = (token: string): string => token.replaceAll('~1', '/').replaceAll('~0', '~');

const decodedReference = (reference: string): string => {
  try {
    return decodeURIComponent(reference);
  } catch {
    throw new FixtureError(`invalid schema reference "${reference}"`, 'fix the percent escape in the $ref');
  }
};

const anchorTarget = (anchor: string, schemas: Record<string, unknown>): ReferenceTarget | undefined => {
  for (const [component, schema] of Object.entries(schemas)) {
    if (!isJsonSchema(schema)) continue;

    const declared: unknown = Reflect.get(schema, '$anchor');

    if (declared !== anchor) continue;

    const target: ReferenceTarget = { component, componentSchema: schema, schema };

    return target;
  }

  return undefined;
};

const pointerStep = (current: unknown, token: string): unknown => {
  if (Array.isArray(current)) return current[Number(token)];

  if (isRecord(current)) return current[token];

  return undefined;
};

/**
 * The schema a `$ref` selects. A `#/components/schemas/<name>` pointer, deeper paths included, must land on something:
 * an undeclared component or an absent path fails with a `FixtureError` and a fix. A `#<anchor>` selects the component
 * declaring that `$anchor`. Anything else (another anchor, another pointer root, a boolean schema or component) is `undefined`, left
 * to the validator.
 */
export const referenceTarget = (reference: string, schemas: Record<string, unknown>): ReferenceTarget | undefined => {
  const decoded = decodedReference(reference);
  const isLocal = decoded.startsWith('#');

  if (!isLocal) return undefined;

  const isPointer = decoded.startsWith('#/');

  if (!isPointer) return anchorTarget(decoded.slice(1), schemas);

  const isSchemaPointer = decoded.startsWith(SCHEMA_POINTER);

  if (!isSchemaPointer) return undefined;

  const tokens = decoded.slice(SCHEMA_POINTER.length).split('/').map(unescapeToken);
  const [name = '', ...path] = tokens;
  const isDeclared = Object.hasOwn(schemas, name);

  if (!isDeclared) throw new FixtureError(`unresolved schema reference "${reference}"`, unresolvedReferenceFix(name));

  const componentSchema = schemas[name];

  if (!isJsonSchema(componentSchema)) return undefined;

  const selected = path.reduce(pointerStep, componentSchema);

  if (selected === undefined) {
    throw new FixtureError(
      `unresolved schema reference "${reference}"`,
      `point the $ref at a schema that exists inside components.schemas["${name}"]`
    );
  }

  if (!isJsonSchema(selected)) return undefined;

  const target: ReferenceTarget = { component: name, componentSchema, schema: selected };

  return target;
};
