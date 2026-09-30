import type { ErrorObject } from 'ajv';

import { missingDocument } from './missing-document.util.ts';
import { compileFixtureSchema } from '../../schema/utils/schema-validator.util.ts';
import { validationDetails } from '../../schema/utils/validation-message.util.ts';
import type { MissingFile, MissingVerdict, MissingViolation } from '../common/missing.type.ts';

const violation = (error: ErrorObject): MissingViolation => {
  const params: Record<string, unknown> = { ...error.params };
  const message = error.message ?? error.keyword;
  const plain: MissingViolation = { instancePath: error.instancePath, keyword: error.keyword, params, message };

  return plain;
};

/** Compiles the missing projection once with AJV; the returned check judges a generated fill on the calling thread. */
export const missingCheck = (missing: MissingFile): ((value: unknown) => MissingVerdict) => {
  const document = missingDocument(missing);
  const validate = compileFixtureSchema(document, missing.dialect);

  const check = (value: unknown): MissingVerdict => {
    const valid = validate(value);
    const found = validate.errors ?? [];
    const details = validationDetails(found);
    const errors = found.map(violation);
    const verdict: MissingVerdict = { valid, details, errors };

    return verdict;
  };

  return check;
};
