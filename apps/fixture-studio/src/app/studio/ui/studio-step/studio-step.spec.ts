import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { StudioStep } from './studio-step.ts';
import { hostOf } from '../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: StudioStep', (): void => {
  let fixture: ComponentFixture<StudioStep>;
  let host: HTMLElement;

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(StudioStep);
    fixture.componentRef.setInput('heading', 'Endpoints');
    fixture.componentRef.setInput('headingId', 'step-endpoints');
    fixture.componentRef.setInput('status', '2 of 9 selected');
    fixture.componentRef.setInput('state', 'active');
    host = hostOf(fixture);
    await fixture.whenStable();
  });

  describe('GIVEN an active step', (): void => {
    it('WHEN rendered THEN is a region labelled by its heading', (): void => {
      expect(host.getAttribute('role')).toBe('region');
      expect(host.getAttribute('aria-labelledby')).toBe('step-endpoints');
      expect(host.querySelector('#step-endpoints')?.textContent).toBe('Endpoints');
    });

    it('WHEN rendered THEN exposes its rail state and status', (): void => {
      expect(host.dataset['state']).toBe('active');
      expect(host.querySelector('.step__status')?.textContent).toBe('2 of 9 selected');
    });
  });

  it('GIVEN the state changes WHEN re-rendered THEN updates the rail state', async (): Promise<void> => {
    fixture.componentRef.setInput('state', 'done');
    await fixture.whenStable();

    expect(host.dataset['state']).toBe('done');
  });
});
