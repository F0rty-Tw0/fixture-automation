import { isRecord } from './record.util.ts';

/** Select one own envelope property, or the whole fixture when the shape is blank. */
export const selectFixtureShape = (fixture: unknown, objectShape: string | undefined): unknown => {
  const key = objectShape?.trim();

  if (!key) return fixture;

  if (!isRecord(fixture)) throw new Error(`fixture has no own property "${key}" for object-shape`);

  const hasKey = Object.hasOwn(fixture, key);

  if (!hasKey) throw new Error(`fixture has no own property "${key}" for object-shape`);

  return fixture[key];
};
