import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { MissingPathList } from './missing-path-list.ts';
import { hostOf, textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';

const MANY_PATHS = Array.from({ length: 21 }, (_value: unknown, index: number): string => `lines[${index}].amount`);

describe('FEATURE: MissingPathList', (): void => {
  let fixture: ComponentFixture<MissingPathList>;

  const openStates = (): boolean[] => {
    const matches = hostOf(fixture).querySelectorAll<HTMLDetailsElement>('.missing__group');
    const groups = [...matches];

    return groups.map((group) => group.open);
  };

  beforeEach((): void => {
    fixture = TestBed.createComponent(MissingPathList);
  });

  describe('GIVEN missing paths under two first segments', (): void => {
    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('paths', ['status', 'customer.id', 'customer.address.city']);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN lists every path with a total count', (): void => {
      expect(textAt(fixture, '.missing__count')).toBe('3');
      expect(textsAt(fixture, '.missing__path')).toStrictEqual(['status', 'customer.id', 'customer.address.city']);
    });

    it('WHEN rendered THEN groups them by first segment, each open with its count', (): void => {
      expect(textsAt(fixture, '.missing__root')).toStrictEqual(['status', 'customer']);
      expect(textsAt(fixture, '.missing__group-count')).toStrictEqual(['1', '2']);
      expect(openStates()).toStrictEqual([true, true]);
    });
  });

  it('GIVEN more paths than fit at a glance WHEN rendered THEN the groups start folded', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', MANY_PATHS);
    await fixture.whenStable();

    expect(openStates()).toStrictEqual([false]);
    expect(textsAt(fixture, '.missing__group-count')).toStrictEqual(['21']);
  });

  it('GIVEN paths inside an envelope WHEN rendered THEN groups below the envelope', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', ['data.memo', 'data.customer.id']);
    fixture.componentRef.setInput('envelope', 'data');
    await fixture.whenStable();

    expect(textsAt(fixture, '.missing__root')).toStrictEqual(['memo', 'customer']);
  });

  it('GIVEN no missing paths WHEN rendered THEN says the fixture is complete', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', []);
    await fixture.whenStable();

    expect(textAt(fixture, '.missing__count')).toBe('0');
    expect(textAt(fixture, '.missing__none')).toContain('Nothing is missing');
  });

  it('GIVEN a heading WHEN rendered THEN titles and labels the list with it', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', ['memo']);
    fixture.componentRef.setInput('heading', 'Replaced values');
    await fixture.whenStable();

    expect(textAt(fixture, '.missing__heading')).toContain('Replaced values');
    expect(hostOf(fixture).querySelector('section')?.getAttribute('aria-label')).toBe('Replaced values');
    expect(hostOf(fixture).querySelector('ul')?.getAttribute('aria-label')).toBe('Replaced values under memo');
  });
});
