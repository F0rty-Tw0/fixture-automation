import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentView } from './document-view.ts';
import { hostOf, textAt, textsAt } from '../../../../test/utils/fixture-dom.spec.util.ts';
import type { FixtureDocument, LineHighlight } from '../../common/document-view.type.ts';

const DOCUMENT: FixtureDocument = {
  format: 'json',
  label: 'Merged fixture',
  fileName: 'invoice.json',
  content: '{\n  "id": "in_1",\n  "status": "open"\n}',
  language: 'json'
};

const FILLED_STATUS: LineHighlight = {
  from: 3,
  to: 3,
  origin: 'missing',
  outcome: 'ai',
  label: 'status · Was missing · Filled by AI'
};
const BROKEN_ID: LineHighlight = { from: 2, to: 2, origin: 'broken', outcome: 'broken', label: 'id · Broken in your fixture' };

/** The editor loads with CodeMirror and fills its lines after a measure pass; retry until `selector` renders. */
const rendered = async (fixture: ComponentFixture<DocumentView>, selector: string): Promise<Element> => {
  const find = (): Element => {
    fixture.detectChanges();

    const element = hostOf(fixture).querySelector(selector);

    if (element === null) throw new Error(`${selector} has not rendered yet.`);

    return element;
  };

  return vi.waitFor(find);
};

describe('FEATURE: DocumentView', (): void => {
  let fixture: ComponentFixture<DocumentView>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(DocumentView);
    fixture.componentRef.setInput('document', DOCUMENT);
  });

  it('GIVEN a document WHEN rendered THEN shows its file bar and loads the editor', async (): Promise<void> => {
    const line = await rendered(fixture, '.cm-line');

    expect(textAt(fixture, '.bar__file')).toBe('invoice.json');
    expect(line.textContent).toBe('{');
  });

  it('GIVEN an original WHEN rendered THEN shows both side by side under headings', async (): Promise<void> => {
    fixture.componentRef.setInput('original', '{\n  "id": "in_1"\n}');

    await rendered(fixture, '.cm-changedLine');

    expect(textsAt(fixture, '.cm-merge-b .cm-changedLine')).toContain('"status": "open"');
    expect(textsAt(fixture, '.document__sides span')).toStrictEqual(['Existing fixture', 'Merged fixture']);
  });

  it('GIVEN no highlights WHEN rendered THEN shows no legend', (): void => {
    fixture.detectChanges();

    expect(hostOf(fixture).querySelector('.document__legend')).toBeNull();
  });

  describe('GIVEN highlights on both sides of a diff', (): void => {
    beforeEach((): void => {
      fixture.componentRef.setInput('original', '{\n  "id": "in_1"\n}');
      fixture.componentRef.setInput('highlights', [FILLED_STATUS]);
      fixture.componentRef.setInput('originalHighlights', [BROKEN_ID]);
    });

    it('WHEN rendered THEN the legend names each outcome and glyph on screen, in order', (): void => {
      fixture.detectChanges();

      expect(textsAt(fixture, '.document__legend-item')).toStrictEqual([
        'Broken in your fixture',
        'A Filled by AI',
        '+ Was missing',
        '! Was broken'
      ]);
    });

    it('WHEN rendered THEN the editor marks the filled line', async (): Promise<void> => {
      const line = await rendered(fixture, '.cm-merge-b .cm-line.cm-fix-ai');

      expect(line.textContent).toContain('"status": "open"');
    });

    it('WHEN the original is dropped THEN the legend forgets its highlights', (): void => {
      fixture.componentRef.setInput('original', undefined);
      fixture.detectChanges();

      expect(textsAt(fixture, '.document__legend-item')).toStrictEqual(['A Filled by AI', '+ Was missing']);
    });
  });
});
