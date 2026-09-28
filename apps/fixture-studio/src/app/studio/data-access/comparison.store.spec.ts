import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { DiffBody, DiffResult } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComparisonStore } from './comparison.store.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { DiffRequest, ExistingFixture } from '../common/comparison.type.ts';
import type { StudioEngine } from '../common/engine.type.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { DIFF_RESULT_STUB } from '../test/stubs/studio.stub.ts';
import { settle } from '../test/utils/studio-http.spec.util.ts';

const FIXTURE = { id: 'in_1' };
const EXISTING: ExistingFixture = { name: 'invoice.json', value: FIXTURE, pretty: '{\n  "id": "in_1"\n}' };
const BODY: DiffBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, requiredOnly: false, objectShape: undefined };
const REQUEST: DiffRequest = { specId: 'spec-1', body: BODY };

describe('FEATURE: comparison store', (): void => {
  let engine: StudioEngine;
  let store: ComparisonStore;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [ComparisonStore, engineProvider] });
    store = TestBed.inject(ComparisonStore);
  });

  it('GIVEN no compare yet WHEN effects run THEN the diff stays idle', (): void => {
    TestBed.tick();

    expect(store.diff.status()).toBe('idle');
    expect(engine.diff).not.toHaveBeenCalled();
  });

  describe('GIVEN a compare request', (): void => {
    let resolveDiff: (result: DiffResult) => void;

    beforeEach((): void => {
      const pendingDiff = async (): Promise<DiffResult> => {
        return new Promise<DiffResult>((resolve) => {
          resolveDiff = resolve;
        });
      };

      vi.mocked(engine.diff).mockImplementation(pendingDiff);
      store.setExisting(EXISTING);
      store.compare(REQUEST);
      TestBed.tick();
    });

    it('WHEN the engine is working THEN is loading and passes the spec and body through', (): void => {
      expect(store.diff.status()).toBe('loading');
      const [specId, body, call] = vi.mocked(engine.diff).mock.calls[0] ?? [];

      expect(specId).toBe('spec-1');
      expect(body).toStrictEqual(BODY);
      expect(call?.signal).toBeInstanceOf(AbortSignal);
    });

    it('WHEN the engine answers THEN exposes the diff', async (): Promise<void> => {
      resolveDiff(DIFF_RESULT_STUB);
      await settle();

      expect(store.diff.value()).toStrictEqual(DIFF_RESULT_STUB);
    });

    it('WHEN another fixture is read THEN drops the diff and the source error', async (): Promise<void> => {
      resolveDiff(DIFF_RESULT_STUB);
      await settle();
      store.rejectSource('bad file');

      store.setExisting(EXISTING);
      TestBed.tick();

      expect(store.diff.status()).toBe('idle');
      expect(store.sourceError()).toBeUndefined();
    });
  });

  it('GIVEN an unreadable source WHEN rejected THEN keeps the message', (): void => {
    store.rejectSource('invoice.ts has no `export const` or `export default` with a value.');

    expect(store.sourceError()).toBe('invoice.ts has no `export const` or `export default` with a value.');
  });
});
