import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportNamingStore } from './export-naming.store.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { EXPORT_SUBDIRECTORY_STORAGE_KEY } from '../common/ai-fill.const.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const QUERY: FixtureNameQuery = { method: 'GET', url: 'v1/invoices/in_1', subdirectory: 'billing' };

describe('FEATURE: export naming store', (): void => {
  let engine: StudioEngine;

  beforeEach((): void => {
    localStorage.clear();
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [engineProvider] });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN nothing stored WHEN created THEN the subdirectory is empty', (): void => {
    const store = TestBed.inject(ExportNamingStore);

    expect(store.subdirectory()).toBe('');
  });

  it('GIVEN a stored subdirectory WHEN created THEN starts with it', (): void => {
    localStorage.setItem(EXPORT_SUBDIRECTORY_STORAGE_KEY, 'billing');

    const store = TestBed.inject(ExportNamingStore);

    expect(store.subdirectory()).toBe('billing');
  });

  it('GIVEN a subdirectory WHEN remembered THEN it applies and is stored for the next session', (): void => {
    const store = TestBed.inject(ExportNamingStore);

    store.rememberSubdirectory('savings');

    expect(store.subdirectory()).toBe('savings');
    expect(localStorage.getItem(EXPORT_SUBDIRECTORY_STORAGE_KEY)).toBe('savings');
  });

  describe('GIVEN storage that throws (private mode, blocked site data)', (): void => {
    beforeEach((): void => {
      const blocked = (): never => {
        throw new DOMException('blocked', 'SecurityError');
      };

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    });

    it('WHEN created THEN the subdirectory is empty', (): void => {
      expect(TestBed.inject(ExportNamingStore).subdirectory()).toBe('');
    });

    it('WHEN a subdirectory is remembered THEN it still applies for this session', (): void => {
      const store = TestBed.inject(ExportNamingStore);

      store.rememberSubdirectory('savings');

      expect(store.subdirectory()).toBe('savings');
    });
  });

  it('GIVEN the engine names the fixture WHEN asked THEN resolves its file name over the given signal', async (): Promise<void> => {
    const signal = new AbortController().signal;

    vi.mocked(engine.fixtureName).mockResolvedValue({ fileName: 'hash.json' });

    const fileName = await TestBed.inject(ExportNamingStore).fileName(QUERY, signal);

    expect(fileName).toBe('hash.json');
    expect(engine.fixtureName).toHaveBeenCalledWith(QUERY, { signal });
  });
});
