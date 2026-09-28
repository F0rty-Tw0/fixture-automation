import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { BrokenValue } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { BrokenValueList } from './broken-value-list.ts';
import { textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';

const PLACEHOLDER: BrokenValue = { path: 'memo', value: 'string', reason: 'openapi-sampler placeholder' };
const LONG_VALUE: BrokenValue = { path: 'notes', value: 'x'.repeat(200), reason: 'must be shorter than 50 characters' };

describe('FEATURE: BrokenValueList', (): void => {
  let fixture: ComponentFixture<BrokenValueList>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(BrokenValueList);
  });

  describe('GIVEN broken values', (): void => {
    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('values', [PLACEHOLDER, LONG_VALUE]);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN lists each path, its value as JSON and the reason, with a count', (): void => {
      expect(textAt(fixture, '.broken__count')).toBe('2');
      expect(textsAt(fixture, '.broken__path')).toStrictEqual(['memo', 'notes']);
      expect(textsAt(fixture, '.broken__reason')).toStrictEqual(['openapi-sampler placeholder', 'must be shorter than 50 characters']);
      expect(textsAt(fixture, '.broken__value')[0]).toBe('"string"');
    });

    it('WHEN a value is long THEN shows it cut', (): void => {
      const preview = textsAt(fixture, '.broken__value')[1] ?? '';

      expect(preview).toHaveLength(120);
      expect(preview.endsWith('…')).toBe(true);
    });
  });

  it('GIVEN no broken values WHEN rendered THEN says every value fits', async (): Promise<void> => {
    fixture.componentRef.setInput('values', []);
    await fixture.whenStable();

    expect(textAt(fixture, '.broken__count')).toBe('0');
    expect(textAt(fixture, '.broken__none')).toContain('No broken values');
  });
});
