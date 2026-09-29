import { isRecord } from '@fixture-automation/shared';

import { FixtureError } from '../../shared/fixture-error/common/fixture.error.ts';

/** Refuse a Swagger 2.0 document by name, so it is not misreported as an OpenAPI spec missing its sections. */
export const refuseSwagger = (value: unknown, subject: string): void => {
  const isSwagger = isRecord(value) && typeof value['swagger'] === 'string';

  if (!isSwagger) return;

  throw new FixtureError(
    `${subject} is Swagger 2.0; only OpenAPI 3 is supported`,
    'convert it to OpenAPI 3 first, for example with https://converter.swagger.io'
  );
};
