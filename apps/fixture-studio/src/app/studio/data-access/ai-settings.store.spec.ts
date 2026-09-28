import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AiSettingsStore } from './ai-settings.store.ts';
import { AI_OPT_IN_STORAGE_KEY } from '../common/ai-fill.const.ts';

describe('FEATURE: AI settings store', (): void => {
  beforeEach((): void => {
    localStorage.clear();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN nothing stored WHEN created THEN on-device AI is off (opt-in)', (): void => {
    const store = TestBed.inject(AiSettingsStore);

    expect(store.isChromeOptedIn()).toBe(false);
  });

  it('GIVEN an opt-in WHEN set THEN it is on and remembered for the next session', (): void => {
    TestBed.inject(AiSettingsStore).setChromeOptIn(true);

    expect(TestBed.inject(AiSettingsStore).isChromeOptedIn()).toBe(true);
    expect(localStorage.getItem(AI_OPT_IN_STORAGE_KEY)).toBe('true');
  });

  it('GIVEN a stored opt-in WHEN created THEN starts opted in', (): void => {
    localStorage.setItem(AI_OPT_IN_STORAGE_KEY, 'true');

    expect(TestBed.inject(AiSettingsStore).isChromeOptedIn()).toBe(true);
  });

  describe('GIVEN storage that throws (private mode, blocked site data)', (): void => {
    beforeEach((): void => {
      const blocked = (): never => {
        throw new DOMException('blocked', 'SecurityError');
      };

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    });

    it('WHEN created THEN falls back to off', (): void => {
      expect(TestBed.inject(AiSettingsStore).isChromeOptedIn()).toBe(false);
    });

    it('WHEN opting in THEN still applies for this session', (): void => {
      const store = TestBed.inject(AiSettingsStore);

      store.setChromeOptIn(true);

      expect(store.isChromeOptedIn()).toBe(true);
    });
  });
});
