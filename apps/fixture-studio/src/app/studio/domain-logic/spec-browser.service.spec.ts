import type { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { ApiErrorBody, Endpoint, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SpecBrowser } from './spec-browser.service.ts';
import { provideHttpStudioEngine } from './studio-engine.provider.ts';
import { DEFAULT_ENDPOINT_FILTER } from '../common/studio.const.ts';
import type { EndpointFilter } from '../common/studio.type.ts';
import { ENDPOINT_STUB, LOADED_SPEC_STUB } from '../test/stubs/studio.stub.ts';
import { answerSpecLoad, configureStudioHttp, failSpecLoad } from '../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const LIST_INVOICES: Endpoint = { ...ENDPOINT_STUB };
const CREATE_INVOICE: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST' };
const INLINE_CUSTOMER: Endpoint = {
  ...ENDPOINT_STUB,
  id: 'GET /v1/customers',
  path: '/v1/customers',
  tags: ['Customers'],
  schemaName: null,
  unsupportedReason: 'Inline response schema'
};
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [LIST_INVOICES, CREATE_INVOICE, INLINE_CUSTOMER] };
const POST_FILTER: EndpointFilter = { ...DEFAULT_ENDPOINT_FILTER, method: 'POST' };
const CUSTOMERS_FILTER: EndpointFilter = { ...DEFAULT_ENDPOINT_FILTER, tag: 'Customers' };

describe('FEATURE: spec browser', (): void => {
  let http: HttpTestingController;
  let browser: SpecBrowser;

  beforeEach((): void => {
    http = configureStudioHttp(STUDIO_ENGINE);
    browser = TestBed.inject(SpecBrowser);
  });

  afterEach((): void => {
    http.verify();
  });

  describe('SCENARIO: loading', (): void => {
    it('GIVEN nothing loaded WHEN read THEN is idle with no endpoints and no error', (): void => {
      expect(browser.isLoading()).toBe(false);
      expect(browser.endpoints()).toStrictEqual([]);
      expect(browser.error()).toBeUndefined();
    });

    it('GIVEN a URL WHEN loading THEN reports loading until the API answers', async (): Promise<void> => {
      browser.loadUrl('https://example.com/openapi.json');
      TestBed.tick();
      const isLoadingInFlight = browser.isLoading();

      await answerSpecLoad(http, SPEC);

      expect(isLoadingInFlight).toBe(true);
      expect(browser.isLoading()).toBe(false);
      expect(browser.endpoints()).toStrictEqual(SPEC.endpoints);
    });

    it('GIVEN a dropped document WHEN loading THEN posts it as the document body', (): void => {
      const document = { openapi: '3.1.0' };

      browser.loadDocument(document);
      TestBed.tick();

      expect(http.expectOne('/api/specs').request.body).toStrictEqual({ document });
    });

    it('GIVEN the API rejects the spec WHEN loaded THEN exposes its message and fix', async (): Promise<void> => {
      const error: ApiErrorBody = { message: 'Swagger 2 is not supported.', fix: 'Convert to OpenAPI 3.' };

      browser.loadUrl('https://example.com/swagger.json');
      await failSpecLoad(http, error);

      expect(browser.error()).toStrictEqual(error);
    });
  });

  describe('SCENARIO: browsing a loaded spec', (): void => {
    beforeEach(async (): Promise<void> => {
      browser.loadUrl('https://example.com/openapi.json');
      await answerSpecLoad(http, SPEC);
    });

    it('GIVEN a method filter WHEN applied THEN shows only matching endpoints', (): void => {
      browser.filter.set(POST_FILTER);

      expect(browser.visibleEndpoints()).toStrictEqual([CREATE_INVOICE]);
    });

    it('GIVEN no filter WHEN grouped THEN groups visible endpoints by tag', (): void => {
      const tags = browser.visibleGroups().map((group) => group.tag);

      expect(tags).toStrictEqual(['Invoices', 'Customers']);
    });

    it('GIVEN the loaded endpoints WHEN listing facets THEN offers their tags and methods', (): void => {
      expect(browser.tags()).toStrictEqual(['Customers', 'Invoices']);
      expect(browser.methods()).toStrictEqual(['GET', 'POST']);
    });

    it('GIVEN a filter WHEN reset THEN shows every endpoint again', (): void => {
      browser.filter.set(POST_FILTER);

      browser.resetFilter();

      expect(browser.visibleEndpoints()).toHaveLength(3);
    });

    describe('GIVEN nothing selected', (): void => {
      it('WHEN toggling all visible THEN selects only supported endpoints', (): void => {
        browser.toggleAllVisible();

        expect(browser.selectedIds()).toStrictEqual(new Set([LIST_INVOICES.id, CREATE_INVOICE.id]));
        expect(browser.allVisibleSelected()).toBe(true);
      });

      it('WHEN one endpoint is toggled THEN counts it as selected', (): void => {
        browser.toggle(LIST_INVOICES.id);

        expect(browser.selectedCount()).toBe(1);
        expect(browser.allVisibleSelected()).toBe(false);
      });
    });

    it('GIVEN every visible endpoint selected WHEN toggling all visible THEN clears them', (): void => {
      browser.toggleAllVisible();

      browser.toggleAllVisible();

      expect(browser.selectedCount()).toBe(0);
    });

    it('GIVEN only unsupported endpoints visible WHEN read THEN all-visible is false', (): void => {
      browser.filter.set(CUSTOMERS_FILTER);

      expect(browser.allVisibleSelected()).toBe(false);
    });
  });
});
