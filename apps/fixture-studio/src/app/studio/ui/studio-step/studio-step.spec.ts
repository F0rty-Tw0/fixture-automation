import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { StudioStep } from './studio-step.ts';
import type { StepState } from '../../common/studio.type.ts';
import { hostOf, requiredElement } from '../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: StudioStep', (): void => {
  let fixture: ComponentFixture<StudioStep>;
  let host: HTMLElement;

  const toggle = (): HTMLElement => requiredElement(fixture, '.step__toggle');

  const body = (): HTMLElement => requiredElement(fixture, '.step__body');

  const render = async (state: StepState): Promise<void> => {
    fixture.componentRef.setInput('state', state);
    await fixture.whenStable();
  };

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(StudioStep);
    fixture.componentRef.setInput('heading', 'Endpoints');
    fixture.componentRef.setInput('headingId', 'step-endpoints');
    fixture.componentRef.setInput('status', '2 of 9 selected');
    host = hostOf(fixture);
    await render('active');
  });

  describe('GIVEN an active step', (): void => {
    it('WHEN rendered THEN is a region labelled by its heading', (): void => {
      expect(host.getAttribute('role')).toBe('region');
      expect(host.getAttribute('aria-labelledby')).toBe('step-endpoints');
      expect(host.querySelector('#step-endpoints')?.textContent.trim()).toBe('Endpoints');
    });

    it('WHEN rendered THEN exposes its rail state and status', (): void => {
      expect(host.dataset['state']).toBe('active');
      expect(host.querySelector('.step__status')?.textContent).toBe('2 of 9 selected');
    });

    it('WHEN rendered THEN is expanded and its toggle controls the body', (): void => {
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('aria-controls')).toBe('step-endpoints-body');
      expect(body().id).toBe('step-endpoints-body');
      expect(body().hasAttribute('hidden')).toBe(false);
    });

    describe('WHEN the heading is clicked', (): void => {
      beforeEach(async (): Promise<void> => {
        toggle().click();
        await fixture.whenStable();
      });

      it('THEN the body folds away, still findable by in-page search', (): void => {
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        expect(body().getAttribute('hidden')).toBe('until-found');
        expect(host.dataset['expanded']).toBe('false');
      });

      it('THEN in-page search opens it again', async (): Promise<void> => {
        body().dispatchEvent(new Event('beforematch'));
        await fixture.whenStable();

        expect(toggle().getAttribute('aria-expanded')).toBe('true');
      });

      it('THEN finishing the step keeps it folded', async (): Promise<void> => {
        await render('done');

        expect(toggle().getAttribute('aria-expanded')).toBe('false');
      });
    });
  });

  it('GIVEN a folded pending step WHEN it becomes active THEN it opens', async (): Promise<void> => {
    await render('pending');
    toggle().click();
    await fixture.whenStable();

    await render('active');

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('GIVEN the state changes WHEN re-rendered THEN updates the rail state', async (): Promise<void> => {
    await render('done');

    expect(host.dataset['state']).toBe('done');
  });

  it('GIVEN the last step WHEN rendered THEN is marked so the rail ends at its node', async (): Promise<void> => {
    fixture.componentRef.setInput('isLast', true);
    await fixture.whenStable();

    expect(host.classList).toContain('step--last');
  });
});
