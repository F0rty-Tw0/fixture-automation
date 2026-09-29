import { missingDocument } from './missing-document.util.ts';
import { compileFixtureSchema } from '../../schema/utils/schema-validator.util.ts';
import { validationDetails } from '../../schema/utils/validation-message.util.ts';
import type { MissingFile, MissingVerdict } from '../common/missing.type.ts';

/** Compiles the missing projection once with AJV; the returned check judges a generated fill on the calling thread. */
export const missingCheck = (missing: MissingFile): ((value: unknown) => MissingVerdict) => {
  const document = missingDocument(missing);
  const validate = compileFixtureSchema(document, missing.dialect);

  const check = (value: unknown): MissingVerdict => {
    const valid = validate(value);
    const details = validationDetails(validate.errors);
    const verdict: MissingVerdict = { valid, details };

    return verdict;
  };

  return check;
};
