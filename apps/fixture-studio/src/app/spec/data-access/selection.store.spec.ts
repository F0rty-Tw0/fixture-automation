import type { HttpTestingController } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SelectionStore } from './selection.store.ts';
import { SpecStore } from './spec.store.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { HttpStudioEngine } from '../../shared/studio-engine/data-access/http-studio.engine.ts';
import { LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { answerSpecLoad, configureStudioHttp } from '../../test/utils/studio-http.spec.util.ts';
import { DEFAULT_ENDPOINT_FILTER } from '../common/spec.const.ts';
import type { EndpointFilter } from '../common/spec.type.ts';

const HTTP_ENGINE: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };

const OTHER_SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, specId: 'spec-2' };
const TAG_FILTER: EndpointFilter = { ...DEFAULT_ENDPOINT_FILTER, tag: 'Invoices' };

describe('FEATURE: selection store', (): void => {
  let http: HttpTestingController;
  let store: SelectionStore;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(HTTP_ENGINE);
    store = TestBed.inject(SelectionStore);
    TestBed.inject(SpecStore).load({ url: 'https://example.com/a.json' });
    await answerSpecLoad(http, LOADED_SPEC_STUB);
  });

  afterEach((): void => {
    http.verify();
  });

  describe('GIVEN a loaded spec', (): void => {
    it('WHEN an id is toggled twice THEN selects then deselects it', (): void => {
      store.toggle('GET /a');
      const afterFirst = new Set(store.selectedIds());

      store.toggle('GET /a');

      expect(afterFirst).toStrictEqual(new Set(['GET /a']));
      expect(store.selectedIds()).toStrictEqual(new Set());
    });

    it('WHEN ids are set as selected THEN adds them all', (): void => {
      store.setSelected(['GET /a', 'GET /b'], true);

      expect(store.selectedIds()).toStrictEqual(new Set(['GET /a', 'GET /b']));
    });
  });

  describe('GIVEN a selection and a filter', (): void => {
    beforeEach((): void => {
      store.toggle('GET /a');
      store.filter.set(TAG_FILTER);
    });

    it('WHEN another spec loads THEN both reset', async (): Promise<void> => {
      TestBed.inject(SpecStore).load({ url: 'https://example.com/b.json' });
      await answerSpecLoad(http, OTHER_SPEC);

      expect(store.selectedIds()).toStrictEqual(new Set());
      expect(store.filter()).toStrictEqual(DEFAULT_ENDPOINT_FILTER);
    });
  });
});
