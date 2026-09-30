import type { FixOrigin, FixOutcome } from './document-view.type.ts';

export const FIX_OUTCOME_LABELS: Record<FixOutcome, string> = {
  broken: 'Broken in your fixture',
  ai: 'Filled by AI',
  sampler: 'Generated from the schema',
  unfilled: 'Still broken'
};

export const FIX_ORIGIN_LABELS: Record<FixOrigin, string> = {
  missing: 'Was missing',
  broken: 'Was broken'
};

/** The gutter glyph beside a highlighted value's first line, for what was wrong before. */
export const FIX_ORIGIN_MARKERS: Record<FixOrigin, string> = {
  missing: '+',
  broken: '!'
};

/** The letter after the origin glyph, so an outcome never rests on colour alone; a broken value needs only `!`. */
export const FIX_OUTCOME_MARKERS: Record<FixOutcome, string> = {
  broken: '',
  ai: 'A',
  sampler: 'S',
  unfilled: '×'
};

/** Legend order: what was wrong first, then the fixes from best to worst. */
export const FIX_OUTCOME_ORDER: FixOutcome[] = ['broken', 'ai', 'sampler', 'unfilled'];

export const FIX_ORIGIN_ORDER: FixOrigin[] = ['missing', 'broken'];
