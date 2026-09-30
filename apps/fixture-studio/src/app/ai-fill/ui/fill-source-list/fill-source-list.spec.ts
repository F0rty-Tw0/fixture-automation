import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { FillSourceList } from './fill-source-list.ts';
import { requiredElement, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';
import type { FilledPath } from '../../../workbench/common/ai-fill.type.ts';

const MIXED: FilledPath[] = [
  { path: 'memo', source: 'ai' },
  { path: 'customer.id', source: 'ai' },
  { path: 'status', source: 'sampler' }
];

const manyPaths = (count: number): FilledPath[] => {
  const pathAt = (_item: unknown, index: number): FilledPath => {
    const filled: FilledPath = { path: `lines[${index}].sku`, source: 'unfilled' };

    return filled;
  };

  return Array.from({ length: count }, pathAt);
};

describe('FEATURE: FillSourceList', (): void => {
  let fixture: ComponentFixture<FillSourceList>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(FillSourceList);
  });

  describe('GIVEN values from the model and the sampler', (): void => {
    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('paths', MIXED);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN lists each path with its source', (): void => {
      expect(textsAt(fixture, '.sources__path')).toStrictEqual(['memo', 'customer.id', 'status']);
      expect(textsAt(fixture, '.sources__source')).toStrictEqual(['Filled by AI', 'Filled by AI', 'Generated from the schema']);
    });

    it('WHEN rendered THEN counts each source that filled something, open', (): void => {
      expect(textAt(fixture, '.sources__counts')).toBe('Filled by AI: 2 · Generated from the schema: 1');
      expect(requiredElement(fixture, '.sources').hasAttribute('open')).toBe(true);
    });
  });

  it('GIVEN more paths than fit WHEN rendered THEN starts folded with the counts showing', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', manyPaths(21));

    await fixture.whenStable();

    expect(requiredElement(fixture, '.sources').hasAttribute('open')).toBe(false);
    expect(textAt(fixture, '.sources__counts')).toBe('Still broken: 21');
  });
});
