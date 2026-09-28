import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { CodeView } from './code-view.ts';
import { rangeRectsMock } from '../../test/mocks/browser.mock.ts';
import { hostOf, requiredElement, textAt } from '../../test/utils/fixture-dom.spec.util.ts';

const JSON_DOC = '{\n  "id": "in_1",\n  "total": 1200\n}';

const editorOf = (fixture: ComponentFixture<CodeView>): HTMLElement | null => {
  const host = hostOf(fixture);

  return host.querySelector<HTMLElement>('.cm-editor');
};

const contentText = (fixture: ComponentFixture<CodeView>): string => {
  const host = hostOf(fixture);

  return host.querySelector('.cm-content')?.textContent ?? '';
};

describe('FEATURE: CodeView', (): void => {
  let fixture: ComponentFixture<CodeView>;

  beforeEach(async (): Promise<void> => {
    rangeRectsMock();
    fixture = TestBed.createComponent(CodeView);
    fixture.componentRef.setInput('doc', JSON_DOC);
    fixture.componentRef.setInput('language', 'json');
    fixture.componentRef.setInput('label', 'Invoice.json');
    await fixture.whenStable();
  });

  describe('GIVEN a rendered JSON document', (): void => {
    it('WHEN rendered THEN creates a CodeMirror editor showing the document', (): void => {
      expect(editorOf(fixture)).not.toBeNull();
      expect(contentText(fixture)).toContain('"total": 1200');
    });

    it('WHEN rendered THEN labels the content as read-only for assistive tech', (): void => {
      const host = hostOf(fixture);
      const content = host.querySelector('.cm-content');

      expect(content?.getAttribute('aria-label')).toBe('Invoice.json');
      expect(content?.getAttribute('aria-readonly')).toBe('true');
    });

    it('WHEN rendered THEN highlights JSON property names', (): void => {
      const host = hostOf(fixture);

      expect(host.querySelector('.tok-propertyName')).not.toBeNull();
    });
  });

  describe('GIVEN a new document input', (): void => {
    it('WHEN the input changes THEN replaces the document in the same editor', async (): Promise<void> => {
      const editor = editorOf(fixture);

      fixture.componentRef.setInput('doc', 'export type Invoice = { id: string };');
      fixture.componentRef.setInput('language', 'typescript');
      await fixture.whenStable();

      expect(editorOf(fixture)).toBe(editor);
      expect(contentText(fixture)).toBe('export type Invoice = { id: string };');
    });

    it('WHEN only the language changes THEN keeps the document', async (): Promise<void> => {
      fixture.componentRef.setInput('language', 'typescript');
      await fixture.whenStable();

      expect(contentText(fixture)).toContain('"id": "in_1"');
    });
  });

  describe('GIVEN an original', (): void => {
    const ORIGINAL = '{\n  "id": "in_1"\n}';

    const buttonNamed = (name: string): HTMLButtonElement => {
      const matches = hostOf(fixture).querySelectorAll('button');
      const buttons = [...matches];
      const match = buttons.find((button) => button.textContent.trim() === name);

      if (match === undefined) throw new Error(`No button named ${name}.`);

      return match;
    };

    const editorLabels = (): (string | null)[] => {
      const host = hostOf(fixture);
      const contents = host.querySelectorAll('.cm-mergeView .cm-content');

      return Array.from(contents, (content: Element): string | null => content.getAttribute('aria-label'));
    };

    beforeEach(async (): Promise<void> => {
      fixture.componentRef.setInput('original', ORIGINAL);
      await fixture.whenStable();
    });

    it('WHEN rendered THEN shows the original and the document side by side', (): void => {
      expect(editorLabels()).toStrictEqual(['Existing Invoice.json', 'Invoice.json']);
    });

    it('WHEN the document changes THEN keeps the side-by-side editors and updates the document side', async (): Promise<void> => {
      const merge = hostOf(fixture).querySelector('.cm-mergeView');

      fixture.componentRef.setInput('doc', '{\n  "id": "in_2"\n}');
      await fixture.whenStable();

      expect(merge).not.toBeNull();
      expect(hostOf(fixture).querySelector('.cm-mergeView')).toBe(merge);
      expect(hostOf(fixture).querySelector('.cm-merge-b .cm-content')?.textContent).toContain('"in_2"');
    });

    it('WHEN rendered THEN the change map marks the one change and counts it', (): void => {
      expect(hostOf(fixture).querySelectorAll('.code-view__mark')).toHaveLength(1);
      expect(textAt(fixture, '.code-view__change-label')).toBe('1 change');
    });

    it('WHEN the next change is asked for THEN names it and the line it starts on', async (): Promise<void> => {
      buttonNamed('Next change').click();
      await fixture.whenStable();

      expect(textAt(fixture, '.code-view__change-label')).toBe('Change 1 of 1, line 2');
      expect(requiredElement(fixture, '.code-view__mark').classList).toContain('code-view__mark--current');
      expect(requiredElement(fixture, '.code-view__mark').getAttribute('y')).toBe('25');
    });

    it('WHEN the previous change is asked for from the top THEN wraps to the last change', async (): Promise<void> => {
      buttonNamed('Previous change').click();
      await fixture.whenStable();

      expect(textAt(fixture, '.code-view__change-label')).toBe('Change 1 of 1, line 2');
    });

    it('WHEN the change map is clicked THEN jumps to the change nearest the click', async (): Promise<void> => {
      requiredElement(fixture, '.code-view__map').click();
      await fixture.whenStable();

      expect(textAt(fixture, '.code-view__change-label')).toBe('Change 1 of 1, line 2');
    });

    it('WHEN the original is cleared THEN falls back to a single editor', async (): Promise<void> => {
      fixture.componentRef.setInput('original', undefined);
      await fixture.whenStable();

      expect(hostOf(fixture).querySelector('.cm-mergeView')).toBeNull();
      expect(hostOf(fixture).querySelector('.code-view__map')).toBeNull();
      expect(contentText(fixture)).toContain('"total": 1200');
    });
  });

  it('GIVEN a rendered editor WHEN the component is destroyed THEN removes the editor', (): void => {
    const host = hostOf(fixture);

    fixture.destroy();

    expect(host.querySelector('.cm-editor')).toBeNull();
  });
});
