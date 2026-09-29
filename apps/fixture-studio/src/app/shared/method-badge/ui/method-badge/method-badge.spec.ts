import { TestBed } from '@angular/core/testing';

import { describe, expect, it } from 'vitest';

import { MethodBadge } from './method-badge.ts';
import { hostOf } from '../../../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: MethodBadge', (): void => {
  it('GIVEN a verb WHEN rendered THEN shows it and tags the host for its color', async (): Promise<void> => {
    const fixture = TestBed.createComponent(MethodBadge);
    const host = hostOf(fixture);

    fixture.componentRef.setInput('method', 'DELETE');
    await fixture.whenStable();

    expect(host.textContent).toBe('DELETE');
    expect(host.dataset['method']).toBe('DELETE');
  });
});
