import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentView } from './document-view.ts';
import type { FixtureDocument } from '../../common/studio.type.ts';
import { hostOf, textAt, textsAt } from '../../test/utils/fixture-dom.spec.util.ts';

const DOCUMENT: FixtureDocument = {
  format: 'json',
  label: 'Merged fixture',
  fileName: 'invoice.json',
  content: '{\n  "id": "in_1",\n  "status": "open"\n}',
  language: 'json'
};

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
});
