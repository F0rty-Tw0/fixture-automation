import type { DiffRequest } from '../common/comparison.type.ts';

/**
 * Whether two diffs would ask the same question. The fixture is compared by reference: each read makes a new value,
 * so a re-read file counts as new even when its content is equal.
 */
export const isSameDiffRequest = (request: DiffRequest, other: DiffRequest | undefined): boolean => {
  if (other === undefined) return false;

  const { body } = request;

  return (
    request.specId === other.specId &&
    body.endpointId === other.body.endpointId &&
    body.fixture === other.body.fixture &&
    body.requiredOnly === other.body.requiredOnly &&
    body.objectShape === other.body.objectShape &&
    body.replacePlaceholders === other.body.replacePlaceholders
  );
};
