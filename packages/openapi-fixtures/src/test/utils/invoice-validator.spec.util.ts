import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';

import type { OpenApiSpec } from '../../common/openapi.type.ts';

export const invoiceValidator = (spec: OpenApiSpec): ValidateFunction => {
  const ajv = new Ajv({ strict: false, validateFormats: false });

  return ajv.compile({ components: spec.components, $ref: '#/components/schemas/invoice' });
};
