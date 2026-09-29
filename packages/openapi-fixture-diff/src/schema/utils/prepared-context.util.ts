import { isRecord } from '@fixture-automation/shared';

import type { SchemaComponents } from '../common/schema.type.ts';

const isComponents = (value: unknown): value is SchemaComponents => {
  if (!isRecord(value)) return false;

  return isRecord(value['schemas']);
};

/** The normalized `components` block that `prepareSchema` embeds in its context document. */
export const contextComponents = (context: string): SchemaComponents => {
  const parsed: unknown = JSON.parse(context);

  if (!isRecord(parsed)) throw new Error('the prepared schema context must be an object');

  const components = parsed['components'];

  if (!isComponents(components)) throw new Error('the prepared schema context must carry components.schemas');

  return components;
};
