import { describe, expect, it } from 'vitest';

import { salvageNote } from './salvage-note.util.ts';
import type { FillSource } from '../../contract/common/studio-api.type.ts';

const MIXED: Record<string, FillSource> = { a: 'ai', b: 'sampler', c: 'sampler', d: 'unfilled' };
const ONE_SAMPLED: Record<string, FillSource> = { a: 'sampler' };

describe('FEATURE: salvage note', (): void => {
  describe('GIVEN sources of every kind', (): void => {
    it('WHEN described THEN counts each kind after the context, in answer, schema, unfilled order', (): void => {
      const note = salvageNote('codex failed', MIXED);

      expect(note).toBe('codex failed; 1 value kept from the answer, 2 values filled from the schema, 1 value left unfilled.');
    });
  });

  describe('GIVEN a single sampled value', (): void => {
    it('WHEN described THEN names only that kind, in the singular', (): void => {
      const note = salvageNote('Chunk 2 of 2: codex failed', ONE_SAMPLED);

      expect(note).toBe('Chunk 2 of 2: codex failed; 1 value filled from the schema.');
    });
  });
});
