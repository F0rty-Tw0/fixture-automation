import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { NoticeList } from './notice-list.ts';
import { hostOf, textAt, textsAt } from '../../../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: NoticeList', (): void => {
  let fixture: ComponentFixture<NoticeList>;

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(NoticeList);
    fixture.componentRef.setInput('heading', 'Compare notes');
    fixture.componentRef.setInput('lines', ['The broken-value check fell back.', 'Envelope detection timed out.']);
    await fixture.whenStable();
  });

  it('GIVEN a heading and lines WHEN rendered THEN announces itself politely under the heading', (): void => {
    const host = hostOf(fixture);

    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-label')).toBe('Compare notes');
  });

  it('GIVEN a heading and lines WHEN rendered THEN shows the heading and every line', (): void => {
    expect(textAt(fixture, '.notices__heading')).toBe('Compare notes');
    expect(textsAt(fixture, '.notices__lines li')).toStrictEqual([
      'The broken-value check fell back.',
      'Envelope detection timed out.'
    ]);
  });
});
