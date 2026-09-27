import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { MissingPathList } from './missing-path-list.ts';
import { hostOf, textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: MissingPathList', (): void => {
  let fixture: ComponentFixture<MissingPathList>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(MissingPathList);
  });

  it('GIVEN missing paths WHEN rendered THEN lists them with a count', async (): Promise<void> => {
    fixture.componentRef.setInput('paths', ['status', 'customer.address.city']);
    await fixture.whenStable();

    expect(textAt(fixture, '.missing__count')).toBe('2');
    expect(textsAt(fixture, '.missing__path')).toStrictEqual(['status', 'customer.address.city']);
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
    expect(hostOf(fixture).querySelector('ul')?.getAttribute('aria-label')).toBe('Replaced values');
  });
});
