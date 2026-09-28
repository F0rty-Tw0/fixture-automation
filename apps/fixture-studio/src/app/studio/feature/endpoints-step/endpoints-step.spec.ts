import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSelectHarness } from '@angular/material/select/testing';

import type { Endpoint, LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EndpointsStep } from './endpoints-step.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { ENDPOINT_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { hostOf, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const LIST_INVOICES: Endpoint = { ...ENDPOINT_STUB };
const CREATE_INVOICE: Endpoint = { ...ENDPOINT_STUB, id: 'POST /v1/invoices', method: 'POST', summary: 'Create an invoice' };
const DOWNLOAD_FILE: Endpoint = {
  ...ENDPOINT_STUB,
  id: 'GET /v1/files/{id}',
  path: '/v1/files/{id}',
  summary: 'Download a file',
  tags: ['Files'],
  schemaName: null,
  unsupportedReason: 'Response is not JSON'
};
const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, endpoints: [LIST_INVOICES, CREATE_INVOICE, DOWNLOAD_FILE] };

const rowPaths = (fixture: ComponentFixture<EndpointsStep>): string[] => textsAt(fixture, '.endpoint-list__path');

describe('FEATURE: EndpointsStep', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<EndpointsStep>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE);
    TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, SPEC);
    fixture = TestBed.createComponent(EndpointsStep);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  describe('GIVEN a loaded spec', (): void => {
    it('WHEN rendered THEN heads the step with title, version, and endpoint count', (): void => {
      const host = hostOf(fixture);

      expect(host.querySelector('.spec')?.textContent).toMatch(/Billing API\s*v1\.0\.0\s*3 endpoints/u);
    });

    it('WHEN rendered THEN lists every endpoint, unsupported ones disabled', async (): Promise<void> => {
      const checkboxes = await loader.getAllHarnesses(MatCheckboxHarness.with({ selector: '.endpoint-list__check' }));
      const disabled = await Promise.all(checkboxes.map(async (checkbox) => checkbox.isDisabled()));

      expect(rowPaths(fixture)).toStrictEqual(['/v1/invoices', '/v1/invoices', '/v1/files/{id}']);
      expect(disabled).toStrictEqual([false, false, true]);
    });

    it('WHEN nothing is selected THEN Generate is disabled', async (): Promise<void> => {
      const generate = await loader.getHarness(MatButtonHarness.with({ text: /Generate/u }));

      expect(await generate.isDisabled()).toBe(true);
    });
  });

  describe('GIVEN the filter controls', (): void => {
    it('WHEN a query is typed THEN lists only matching endpoints', async (): Promise<void> => {
      const query = await loader.getHarness(MatInputHarness);

      await query.setValue('download');

      expect(rowPaths(fixture)).toStrictEqual(['/v1/files/{id}']);
    });

    it('WHEN a method is picked THEN lists only that method', async (): Promise<void> => {
      const [, method] = await loader.getAllHarnesses(MatSelectHarness);

      await method?.clickOptions({ text: 'POST' });

      expect(rowPaths(fixture)).toStrictEqual(['/v1/invoices']);
    });

    it('WHEN nothing matches THEN offers to clear the filters', async (): Promise<void> => {
      const query = await loader.getHarness(MatInputHarness);

      await query.setValue('no such endpoint');
      const clear = await loader.getHarness(MatButtonHarness.with({ text: 'Clear filters' }));

      await clear.click();

      expect(rowPaths(fixture)).toHaveLength(3);
    });
  });

  describe('GIVEN select all visible', (): void => {
    it('WHEN checked THEN selects the supported visible endpoints and enables Generate', async (): Promise<void> => {
      const selectAll = await loader.getHarness(MatCheckboxHarness.with({ label: /Select all visible/u }));

      await selectAll.check();
      const generate = await loader.getHarness(MatButtonHarness.with({ text: /Generate/u }));

      expect(TestBed.inject(SpecBrowser).selectedIds()).toStrictEqual(new Set([LIST_INVOICES.id, CREATE_INVOICE.id]));
      expect(await generate.getText()).toBe('Generate 2 fixtures');
      expect(await generate.isDisabled()).toBe(false);
    });

    it('WHEN a filter hides some endpoints THEN selects only the visible ones', async (): Promise<void> => {
      const query = await loader.getHarness(MatInputHarness);
      const selectAll = await loader.getHarness(MatCheckboxHarness.with({ label: /Select all visible/u }));

      await query.setValue('create');
      await selectAll.check();

      expect(TestBed.inject(SpecBrowser).selectedIds()).toStrictEqual(new Set([CREATE_INVOICE.id]));
    });
  });

  describe('GIVEN the format options', (): void => {
    it('WHEN every format is unchecked THEN explains that one is required', async (): Promise<void> => {
      const json = await loader.getHarness(MatCheckboxHarness.with({ label: 'JSON fixture' }));
      const stub = await loader.getHarness(MatCheckboxHarness.with({ label: 'TS stub' }));

      await json.uncheck();
      await stub.uncheck();

      const host = hostOf(fixture);

      expect(host.querySelector('.options__error')?.textContent).toBe('Pick at least one format.');
    });
  });
});
