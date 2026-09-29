import type { ErrorObject } from 'ajv';

const validationMessage = (error: ErrorObject): string => {
  const path = error.instancePath || '/';
  const message = error.message ?? error.keyword;

  return `${path}: ${message}`;
};

/** Join AJV errors into one `path: message; path: message` diagnostic line. */
export const validationDetails = (errors: ErrorObject[] | null | undefined): string => {
  const found = errors ?? [];
  const messages = found.map(validationMessage);
  const details = messages.join('; ');

  return details;
};
