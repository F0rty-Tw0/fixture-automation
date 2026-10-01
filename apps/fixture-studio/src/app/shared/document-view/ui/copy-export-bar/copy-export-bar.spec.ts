import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CopyExportBar } from './copy-export-bar.ts';
import { clipboardMock } from '../../../../test/mocks/browser.mock.ts';
import { textAt } from '../../../../test/utils/fixture-dom.spec.util.ts';
import type { ExportNaming, HashedExport } from '../../common/document-view.type.ts';
import { exportNamingMock } from '../../test/mocks/export-naming.mock.ts';

const CONTENT = '{ "id": "in_1" }';
const URL_FIELD = MatInputHarness.with({ selector: '[name="url"]' });
const SUBDIRECTORY_FIELD = MatInputHarness.with({ selector: '[name="subdirectory"]' });
const EXPORT_BUTTON = MatButtonHarness.with({ text: 'Export' });

type DownloadCapture = {
  readonly blobs: Blob[];
  readonly anchors: HTMLAnchorElement[];
};

/** jsdom has no object URLs and would navigate on click; record both instead. */
const captureDownloads = (): DownloadCapture => {
  const blobs: Blob[] = [];
  const anchors: HTMLAnchorElement[] = [];
  const createObjectUrl = (blob: Blob): string => {
    blobs.push(blob);

    return 'blob:fixture';
  };
  const recordClick = function (this: HTMLAnchorElement): void {
    anchors.push(this);
  };
  const capture: DownloadCapture = { blobs, anchors };

  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(recordClick);
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });

  return capture;
};

describe('FEATURE: CopyExportBar', (): void => {
  let fixture: ComponentFixture<CopyExportBar>;
  let loader: HarnessLoader;
  let rootLoader: HarnessLoader;
  let clipboard: Clipboard;

  beforeEach(async (): Promise<void> => {
    clipboard = clipboardMock();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard });
    fixture = TestBed.createComponent(CopyExportBar);
    fixture.componentRef.setInput('fileName', 'Invoice.json');
    fixture.componentRef.setInput('content', CONTENT);
    loader = TestbedHarnessEnvironment.loader(fixture);
    rootLoader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    await fixture.whenStable();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN a document WHEN rendered THEN shows its file name and size', (): void => {
    expect(textAt(fixture, '.bar__file')).toBe('Invoice.json');
    expect(textAt(fixture, '.bar__size')).toBe('16 B');
  });

  describe('GIVEN clipboard access', (): void => {
    it('WHEN Copy is pressed THEN writes the content and confirms', async (): Promise<void> => {
      const copy = await loader.getHarness(MatButtonHarness.with({ text: 'Copy' }));

      await copy.click();
      const snackBar = await rootLoader.getHarness(MatSnackBarHarness);

      expect(clipboard.writeText).toHaveBeenCalledWith(CONTENT);
      expect(await snackBar.getMessage()).toBe('Copied Invoice.json');
    });
  });

  describe('GIVEN the browser blocks the clipboard', (): void => {
    it('WHEN Copy is pressed THEN suggests Export instead', async (): Promise<void> => {
      vi.mocked(clipboard.writeText).mockRejectedValue(new Error('denied'));
      const copy = await loader.getHarness(MatButtonHarness.with({ text: 'Copy' }));

      await copy.click();
      const snackBar = await rootLoader.getHarness(MatSnackBarHarness);

      expect(await snackBar.getMessage()).toBe('The browser blocked clipboard access. Use Export instead.');
    });
  });

  describe('GIVEN Export', (): void => {
    it('WHEN pressed THEN downloads the content under the file name', async (): Promise<void> => {
      const downloads = captureDownloads();
      const exportButton = await loader.getHarness(MatButtonHarness.with({ text: 'Export' }));

      await exportButton.click();
      const texts = await Promise.all(downloads.blobs.map(async (blob) => blob.text()));

      expect(texts).toStrictEqual([CONTENT]);
      expect(downloads.blobs.map((blob) => blob.type)).toStrictEqual(['application/json']);
      expect(downloads.anchors.map((anchor) => anchor.download)).toStrictEqual(['Invoice.json']);
      expect(downloads.anchors.map((anchor) => anchor.href)).toStrictEqual(['blob:fixture']);
    });
  });

  it('GIVEN no hashed export WHEN rendered THEN offers no hashed naming', async (): Promise<void> => {
    const toggles = await loader.getAllHarnesses(MatSlideToggleHarness);

    expect(toggles).toHaveLength(0);
  });

  describe('GIVEN a hashed export for an endpoint with a path parameter', (): void => {
    let naming: ExportNaming;

    const turnOnHashing = async (): Promise<void> => {
      const toggle = await loader.getHarness(MatSlideToggleHarness);

      await toggle.check();
    };

    const enterUrl = async (url: string): Promise<void> => {
      await turnOnHashing();
      const field = await loader.getHarness(URL_FIELD);

      await field.setValue(url);
    };

    beforeEach(async (): Promise<void> => {
      naming = exportNamingMock();
      naming.rememberSubdirectory('billing');
      vi.mocked(naming.fileName).mockResolvedValue('hash.json');
      const hashedExport: HashedExport = { method: 'GET', path: '/v1/invoices/{id}', naming };

      fixture.componentRef.setInput('hashedExport', hashedExport);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN keeps the plain name with hashed naming off', async (): Promise<void> => {
      const toggle = await loader.getHarness(MatSlideToggleHarness);
      const fields = await loader.getAllHarnesses(MatInputHarness);

      expect(await toggle.isChecked()).toBe(false);
      expect(fields).toHaveLength(0);
      expect(textAt(fixture, '.bar__file')).toBe('Invoice.json');
    });

    describe('WHEN hashed naming is turned on', (): void => {
      beforeEach(async (): Promise<void> => {
        await turnOnHashing();
      });

      it('THEN prefills the URL with the path template and the subdirectory with the remembered one', async (): Promise<void> => {
        const url = await loader.getHarness(URL_FIELD);
        const subdirectory = await loader.getHarness(SUBDIRECTORY_FIELD);

        expect(await url.getValue()).toBe('/v1/invoices/{id}');
        expect(await subdirectory.getValue()).toBe('billing');
      });

      it('THEN names the template as the wizard route flow does and allows Export', async (): Promise<void> => {
        const query = { method: 'GET', url: '/v1/invoices/{id}', subdirectory: 'billing' };
        const exportButton = await loader.getHarness(EXPORT_BUTTON);

        expect(await exportButton.isDisabled()).toBe(false);
        expect(naming.fileName).toHaveBeenLastCalledWith(query, expect.any(AbortSignal));
        expect(textAt(fixture, '.bar__file')).toBe('hash.json');
      });

      it('THEN hints which CLI flow the template matches and how to match a merge run', (): void => {
        expect(textAt(fixture, '.bar__reason')).toBe(
          "Kept as the template: matches the wizard's route target. Replace {id} to match a merge run with a real URL."
        );
      });
    });

    describe('WHEN the URL is made concrete', (): void => {
      beforeEach(async (): Promise<void> => {
        await enterUrl('/v1/invoices/in_1');
      });

      it('THEN shows the hashed name asked for with the method, URL and subdirectory', (): void => {
        const query = { method: 'GET', url: '/v1/invoices/in_1', subdirectory: 'billing' };

        expect(naming.fileName).toHaveBeenLastCalledWith(query, expect.any(AbortSignal));
        expect(textAt(fixture, '.bar__file')).toBe('hash.json');
      });

      it('THEN shows no template hint', (): void => {
        expect(textAt(fixture, '.bar__reason')).toBe('');
      });

      it('THEN Export downloads under the hashed name', async (): Promise<void> => {
        const downloads = captureDownloads();
        const exportButton = await loader.getHarness(EXPORT_BUTTON);

        await exportButton.click();

        expect(downloads.anchors.map((anchor) => anchor.download)).toStrictEqual(['hash.json']);
      });
    });

    it('WHEN the subdirectory is changed THEN remembers it and names with it', async (): Promise<void> => {
      await enterUrl('v1/invoices/in_1');
      const subdirectory = await loader.getHarness(SUBDIRECTORY_FIELD);

      await subdirectory.setValue('savings');

      expect(naming.rememberSubdirectory).toHaveBeenLastCalledWith('savings');
      expect(naming.fileName).toHaveBeenLastCalledWith(
        { method: 'GET', url: 'v1/invoices/in_1', subdirectory: 'savings' },
        expect.any(AbortSignal)
      );
    });

    it('WHEN the URL holds a lone brace THEN still hints that it is template', async (): Promise<void> => {
      await enterUrl('/v1/invoices/{id');

      expect(textAt(fixture, '.bar__reason')).toBe(
        "Kept as the template: matches the wizard's route target. Replace the braces to match a merge run with a real URL."
      );
    });

    it('WHEN Copy is pressed while no hashed name is known THEN confirms with the plain name', async (): Promise<void> => {
      await enterUrl('');
      const copy = await loader.getHarness(MatButtonHarness.with({ text: 'Copy' }));

      await copy.click();
      const snackBar = await rootLoader.getHarness(MatSnackBarHarness);

      expect(await snackBar.getMessage()).toBe('Copied Invoice.json');
    });

    it('WHEN the URL is emptied THEN blocks Export and asks for a URL', async (): Promise<void> => {
      await enterUrl('');
      const exportButton = await loader.getHarness(EXPORT_BUTTON);

      expect(await exportButton.isDisabled()).toBe(true);
      expect(textAt(fixture, '.bar__reason')).toBe('Enter the endpoint URL to export under the hashed name.');
    });

    it('WHEN the API refuses to name it THEN blocks Export and says why', async (): Promise<void> => {
      vi.mocked(naming.fileName).mockRejectedValue(new Error('The Fixture Studio API did not answer.'));

      await enterUrl('v1/invoices/in_1');
      const exportButton = await loader.getHarness(EXPORT_BUTTON);

      expect(await exportButton.isDisabled()).toBe(true);
      expect(textAt(fixture, '.bar__reason')).toBe('No hashed name: The Fixture Studio API did not answer.');
    });
  });
});
