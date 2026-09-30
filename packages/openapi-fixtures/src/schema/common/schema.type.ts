import type { JSONSchema7 } from 'json-schema';

/** Where a `$ref` lands: the component it points into, and the schema it selects there. */
export type ReferenceTarget = {
  readonly component: string;
  readonly componentSchema: JSONSchema7;
  /** The component itself, or a schema inside it for a deeper pointer. */
  readonly schema: JSONSchema7;
};
