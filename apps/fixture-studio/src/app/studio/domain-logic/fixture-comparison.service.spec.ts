import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { LoadedSpec } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureComparison } from './fixture-comparison.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import { SpecBrowser } from './spec-browser.service.ts';
import type { CompareForm } from '../common/comparison.type.ts';
import type { StudioEngine } from '../common/engine.type.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { DIFF_RESULT_STUB, LOADED_SPEC_STUB } from '../test/stubs/studio.stub.ts';
import { settle } from '../test/utils/studio-http.spec.util.ts';

const SPEC: LoadedSpec = { ...LOADED_SPEC_STUB, specId: 'spec-1' };
const PAYLOAD = { id: 1 };
const ENVELOPE_FORM: CompareForm = { pasted: '', objectShape: ' data ', replacePlaceholders: false };

describe('FEATURE: fixture comparison', (): void => {
  let engine: StudioEngine;
  let comparison: FixtureComparison;

  beforeEach((): void => {
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
    comparison = TestBed.inject(FixtureComparison);
  });

  describe('SCENARIO: reading the existing fixture', (): void => {
    it('GIVEN a JSON file WHEN read THEN keeps its value and pretty text', async (): Promise<void> => {
      await comparison.readFile(new File(['{"id":"in_1"}'], 'invoice.json'));

      const value = { id: 'in_1' };

      expect(comparison.existing()).toStrictEqual({ name: 'invoice.json', value, pretty: '{\n  "id": "in_1"\n}\n' });
    });

    it('GIVEN a TypeScript file with a call WHEN read THEN explains the rejection', async (): Promise<void> => {
      await comparison.readFile(new File(['export const A = { at: now() };'], 'invoice.ts'));

      expect(comparison.existing()).toBeUndefined();
      expect(comparison.sourceError()).toContain('a function call');
    });

    it('GIVEN a TypeScript file WHEN its read is in flight THEN names it as being read until it settles', async (): Promise<void> => {
      const read = comparison.readFile(new File(["export const A = { id: 'x' };"], 'invoice.ts'));

      expect(comparison.readingName()).toBe('invoice.ts');

      await read;

      expect(comparison.readingName()).toBeUndefined();
    });

    it('GIVEN a rejected file WHEN read THEN clears the reading name', async (): Promise<void> => {
      await comparison.readFile(new File(['export const A = { at: now() };'], 'invoice.ts'));

      expect(comparison.readingName()).toBeUndefined();
    });

    it('GIVEN pasted text WHEN read THEN names it as pasted', async (): Promise<void> => {
      comparison.form.set({ pasted: '{"id":1}', objectShape: '', replacePlaceholders: true });

      await comparison.readPasted();

      expect(comparison.existing()?.name).toBe('Pasted text');
    });
  });

  describe('SCENARIO: comparing', (): void => {
    it('GIVEN no loaded spec WHEN compared THEN asks the engine nothing', async (): Promise<void> => {
      await comparison.readFile(new File(['{}'], 'a.json'));

      comparison.compare('GET /v1/invoices');
      TestBed.tick();

      expect(engine.diff).not.toHaveBeenCalled();
    });

    describe('GIVEN a loaded spec and an existing fixture', (): void => {
      beforeEach(async (): Promise<void> => {
        vi.mocked(engine.loadSpec).mockResolvedValue(SPEC);
        vi.mocked(engine.diff).mockResolvedValue(DIFF_RESULT_STUB);
        TestBed.inject(SpecBrowser).loadUrl('https://example.com/a.json');
        await settle();
        await comparison.readFile(new File(['{"data":{"id":1}}'], 'a.json'));
      });

      it('WHEN compared with an envelope THEN diffs inside it, following the required-only and replace options', async (): Promise<void> => {
        comparison.form.set(ENVELOPE_FORM);

        comparison.compare('GET /v1/invoices');
        await settle();

        const fixture = { data: PAYLOAD };
        const expectedBody = { endpointId: 'GET /v1/invoices', fixture, requiredOnly: false, objectShape: 'data', replacePlaceholders: false };

        expect(engine.diff).toHaveBeenCalledWith('spec-1', expectedBody, expect.anything());
        expect(comparison.result()).toStrictEqual(DIFF_RESULT_STUB);
      });

      it('WHEN compared without an envelope THEN leaves it out', async (): Promise<void> => {
        comparison.compare('GET /v1/invoices');
        await settle();

        const [, body] = vi.mocked(engine.diff).mock.calls[0] ?? [];

        expect(body?.objectShape).toBeUndefined();
      });

      it('WHEN compared with the default form THEN asks to replace placeholders', async (): Promise<void> => {
        comparison.compare('GET /v1/invoices');
        await settle();

        const [, body] = vi.mocked(engine.diff).mock.calls[0] ?? [];

        expect(body?.replacePlaceholders).toBe(true);
      });

      it('WHEN compared THEN reports the shown diff as current for that endpoint only', async (): Promise<void> => {
        comparison.compare('GET /v1/invoices');
        await settle();

        expect(comparison.isCurrent('GET /v1/invoices')).toBe(true);
        expect(comparison.isCurrent('POST /v1/invoices')).toBe(false);
      });

      it('WHEN compared again with nothing changed THEN diffs only once', async (): Promise<void> => {
        comparison.compare('GET /v1/invoices');
        await settle();
        comparison.compare('GET /v1/invoices');
        await settle();

        expect(engine.diff).toHaveBeenCalledTimes(1);
      });

      it('WHEN an option changes after a compare THEN the diff is stale and compares again', async (): Promise<void> => {
        comparison.compare('GET /v1/invoices');
        await settle();
        comparison.form.set(ENVELOPE_FORM);

        expect(comparison.isCurrent('GET /v1/invoices')).toBe(false);

        comparison.compare('GET /v1/invoices');
        await settle();

        expect(engine.diff).toHaveBeenCalledTimes(2);
      });

      it('WHEN the last compare failed THEN the same compare can be retried', async (): Promise<void> => {
        vi.mocked(engine.diff).mockRejectedValueOnce(new Error('offline'));
        comparison.compare('GET /v1/invoices');
        await settle();

        expect(comparison.isCurrent('GET /v1/invoices')).toBe(false);

        comparison.compare('GET /v1/invoices');
        await settle();

        expect(engine.diff).toHaveBeenCalledTimes(2);
        expect(comparison.result()).toStrictEqual(DIFF_RESULT_STUB);
      });

      it('WHEN the engine fails THEN exposes its message', async (): Promise<void> => {
        const failure = Object.assign(new Error('spec not found'), { fix: 'Reload the spec.' });

        vi.mocked(engine.diff).mockRejectedValue(failure);
        comparison.compare('GET /v1/invoices');
        await settle();

        expect(comparison.error()).toStrictEqual({ message: 'spec not found', fix: 'Reload the spec.' });
      });
    });
  });
});
