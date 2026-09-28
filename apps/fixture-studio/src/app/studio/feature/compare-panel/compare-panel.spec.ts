import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatInputHarness } from '@angular/material/input/testing';

import type { DiffResult } from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ComparePanel } from './compare-panel.ts';
import { provideFixtureWorkbench } from '../../domain-logic/fixture-workbench.provider.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { provideHttpStudioEngine } from '../../domain-logic/studio-engine.provider.ts';
import { DIFF_RESULT_STUB, FIXTURE_VIEW_STUB, LOADED_SPEC_STUB } from '../../test/stubs/studio.stub.ts';
import { hostOf, requiredElement, textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';
import { answerSpecLoad, configureStudioHttp, settle } from '../../test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

const dropFile = (fixture: ComponentFixture<ComparePanel>, file: File): void => {
  const drop = new Event('drop', { cancelable: true });
  const dataTransfer = { files: [file] };

  Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
  requiredElement(fixture, '.drop').dispatchEvent(drop);
};

/** Files are read asynchronously; retry until the panel shows the result. */
const shown = async (fixture: ComponentFixture<ComparePanel>, selector: string): Promise<string> => {
  const read = (): string => {
    fixture.detectChanges();

    const text = textAt(fixture, selector);

    if (text === '') throw new Error(`Nothing rendered at ${selector} yet.`);

    return text;
  };

  return vi.waitFor(read);
};

/**
 * Answers the diff the panel sent and renders the result; returns the body that was sent. While a diff is open, harness
 * actions wait for a settle that never comes, so clicks that start a diff go through the DOM.
 */
const answerDiff = async (
  http: HttpTestingController,
  fixture: ComponentFixture<ComparePanel>,
  result: DiffResult = DIFF_RESULT_STUB
): Promise<unknown> => {
  TestBed.tick();
  const request = http.expectOne('/api/specs/spec-1/diff');
  const sent: unknown = request.request.body;

  request.flush(result);
  await settle();
  fixture.detectChanges();

  return sent;
};

describe('FEATURE: ComparePanel', (): void => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ComparePanel>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    http = configureStudioHttp(STUDIO_ENGINE, provideFixtureWorkbench());
    TestBed.inject(SpecBrowser).loadUrl('https://example.com/openapi.json');
    await answerSpecLoad(http, LOADED_SPEC_STUB);
    fixture = TestBed.createComponent(ComparePanel);
    fixture.componentRef.setInput('view', FIXTURE_VIEW_STUB);
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    http.verify();
  });

  it('GIVEN no fixture yet WHEN rendered THEN offers a drop zone and a paste box, but no compare', (): void => {
    expect(textAt(fixture, '.drop__title')).toBe('Drop an existing fixture');
    expect(hostOf(fixture).querySelector('.compare__run')).toBeNull();
  });

  describe('GIVEN a dropped JSON fixture', (): void => {
    beforeEach(async (): Promise<void> => {
      dropFile(fixture, new File(['{"id":"in_1"}'], 'invoice.json'));
      await shown(fixture, '.compare__name');
    });

    it('WHEN read THEN names it and compares it at once, replacing placeholders by default', async (): Promise<void> => {
      const sent = await answerDiff(http, fixture);
      const replace = await loader.getHarness(MatCheckboxHarness.with({ label: 'Replace placeholder and invalid values' }));

      expect(textAt(fixture, '.compare__name')).toBe('invoice.json');
      expect(await replace.isChecked()).toBe(true);
      expect(sent).toMatchObject({ replacePlaceholders: true });
    });

    it('WHEN the diff answers THEN lists the missing paths and steps the compare button back', async (): Promise<void> => {
      await answerDiff(http, fixture);
      const compare = await loader.getHarness(MatButtonHarness.with({ text: 'Compare with schema' }));

      expect(textAt(fixture, '.missing__count')).toBe('1');
      expect(textsAt(fixture, '.missing__path')).toStrictEqual(['status']);
      expect(await compare.getAppearance()).toBe('outlined');
    });

    it('WHEN the replace box is unchecked after the diff THEN compare turns primary and asks to keep them', async (): Promise<void> => {
      await answerDiff(http, fixture);
      const replace = await loader.getHarness(MatCheckboxHarness.with({ label: 'Replace placeholder and invalid values' }));
      const compare = await loader.getHarness(MatButtonHarness.with({ text: 'Compare with schema' }));

      await replace.uncheck();

      expect(await compare.getAppearance()).toBe('filled');

      requiredElement(fixture, '.compare__submit').click();
      const sent = await answerDiff(http, fixture);

      expect(sent).toMatchObject({ replacePlaceholders: false });
    });

    it('WHEN the diff replaced values THEN lists them apart from the missing paths and counts both on the fill', async (): Promise<void> => {
      const replaced: DiffResult = { ...DIFF_RESULT_STUB, missingPaths: ['status', 'memo', 'id'], replacedPaths: ['memo', 'id'] };

      await answerDiff(http, fixture, replaced);
      const fillButton = await loader.getHarness(MatButtonHarness.with({ text: /with AI/u }));

      expect(textsAt(fixture, '.missing__heading')).toStrictEqual(['Missing paths 1', 'Replaced values 2']);
      expect(textsAt(fixture, '.missing__path')).toStrictEqual(['status', 'memo', 'id']);
      expect(await fillButton.getText()).toBe('Fill 3 values with AI');
    });
  });

  it('GIVEN a TypeScript fixture WHEN dropped THEN says it is being read until the parse settles', async (): Promise<void> => {
    dropFile(fixture, new File(["export const A = { id: 'x' };"], 'invoice.ts'));
    fixture.detectChanges();

    expect(textAt(fixture, '.compare__reading')).toBe('Reading invoice.ts…');

    await shown(fixture, '.compare__name');

    expect(hostOf(fixture).querySelector('.compare__reading')).toBeNull();

    await answerDiff(http, fixture);
  });

  it('GIVEN a TypeScript fixture with a call WHEN dropped THEN explains why it cannot be read', async (): Promise<void> => {
    dropFile(fixture, new File(['export const A = { at: now() };'], 'invoice.ts'));

    const message = await shown(fixture, '.compare__source-error');

    expect(message).toContain('a function call');
  });

  it('GIVEN pasted text WHEN used THEN reads it as the existing fixture', async (): Promise<void> => {
    const paste = await loader.getHarness(MatInputHarness);

    await paste.setValue('{"id":1}');
    requiredElement(fixture, '.compare__paste button').click();

    expect(await shown(fixture, '.compare__name')).toBe('Pasted text');

    await answerDiff(http, fixture);
  });
});
