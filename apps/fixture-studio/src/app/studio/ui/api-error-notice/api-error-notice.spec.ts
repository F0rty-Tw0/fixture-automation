import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApiErrorNotice } from './api-error-notice.ts';
import { hostOf } from '../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: ApiErrorNotice', (): void => {
  let fixture: ComponentFixture<ApiErrorNotice>;
  let host: HTMLElement;

  beforeEach((): void => {
    fixture = TestBed.createComponent(ApiErrorNotice);
    host = hostOf(fixture);
  });

  describe('GIVEN an error with a fix', (): void => {
    beforeEach(async (): Promise<void> => {
      const error: ApiErrorBody = { message: 'Spec URL answered 404.', fix: 'Check the URL.' };

      fixture.componentRef.setInput('error', error);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN announces itself as an alert', (): void => {
      expect(host.getAttribute('role')).toBe('alert');
    });

    it('WHEN rendered THEN shows the message and the fix', (): void => {
      expect(host.querySelector('.notice__message')?.textContent).toBe('Spec URL answered 404.');
      expect(host.querySelector('.notice__fix')?.textContent).toBe('Fix Check the URL.');
    });
  });

  it('GIVEN an error without a fix WHEN rendered THEN shows only the message', async (): Promise<void> => {
    const error: ApiErrorBody = { message: 'Unexpected failure.', fix: undefined };

    fixture.componentRef.setInput('error', error);
    await fixture.whenStable();

    expect(host.querySelector('.notice__fix')).toBeNull();
  });
});
