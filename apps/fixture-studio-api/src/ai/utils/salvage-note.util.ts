import type { FillSource } from '../../contract/common/studio-api.type.ts';

type SourcePhrase = {
  readonly source: FillSource;
  readonly phrase: string;
};

const SOURCE_PHRASES: SourcePhrase[] = [
  { source: 'ai', phrase: 'kept from the answer' },
  { source: 'sampler', phrase: 'filled from the schema' },
  { source: 'unfilled', phrase: 'left unfilled' }
];

const countPhrase = (count: number, phrase: string): string => {
  const noun = count === 1 ? 'value' : 'values';

  return `${count} ${noun} ${phrase}`;
};

/** `context` followed by how many values each source supplied, e.g. `…; 2 values filled from the schema.` */
export const salvageNote = (context: string, sources: Record<string, FillSource>): string => {
  const values = Object.values(sources);
  const parts: string[] = [];

  for (const { source, phrase } of SOURCE_PHRASES) {
    const count = values.filter((value: FillSource): boolean => value === source).length;

    if (count > 0) parts.push(countPhrase(count, phrase));
  }

  return `${context}; ${parts.join(', ')}.`;
};
