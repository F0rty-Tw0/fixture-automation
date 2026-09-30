import type { ErrorObject } from 'ajv';

/** An AJV error, or the plain `MissingViolation` copy of one. */
type ValidationError = Pick<ErrorObject, 'instancePath' | 'keyword' | 'message'>;

const validationMessage = (error: ValidationError): string => {
  const path = error.instancePath || '/';
  const message = error.message ?? error.keyword;

  return `${path}: ${message}`;
};

/** Join AJV errors into one `path: message; path: message` diagnostic line. */
export const validationDetails = (errors: ValidationError[] | null | undefined): string => {
  const found = errors ?? [];
  const messages = found.map(validationMessage);
  const details = messages.join('; ');

  return details;
};
