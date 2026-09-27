import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input } from '@angular/core';

import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import { Compartment, EditorState } from '@codemirror/state';
import type { ChangeSpec, Extension, StateEffect, TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';

import type { CodeLanguage } from '../../common/studio.type.ts';
import { lineDiff } from '../../utils/line-diff.util.ts';

/** Diffs line by line; CodeMirror's default character diff smears distant edits in a large fixture together. */
const DIFF_CONFIG = { override: lineDiff };

const languageExtension = (language: CodeLanguage): Extension => {
  if (language === 'json') return json();

  return javascript({ typescript: true });
};

/** Swaps the language, and the document too when it differs, in one transaction. */
const syncEditor = (view: EditorView, doc: string, languageEffect: StateEffect<unknown>): void => {
  const effects = [languageEffect];
  const currentDoc = view.state.sliceDoc();
  const isSameDoc = currentDoc === doc;

  if (isSameDoc) {
    const reconfiguration: TransactionSpec = { effects };

    view.dispatch(reconfiguration);

    return;
  }

  const changes: ChangeSpec = { from: 0, to: view.state.doc.length, insert: doc };
  const selection = { anchor: 0 };
  const replacement: TransactionSpec = { changes, effects, selection, scrollIntoView: true };

  view.dispatch(replacement);
};

/**
 * Read-only CodeMirror 6 view. The document never passes through Angular bindings:
 * it is handed to CodeMirror once, then replaced by a transaction, so multi-megabyte
 * sources stay responsive (CodeMirror renders only the visible lines). Set `original` to show it
 * and the document side by side as a diff: removals marked on the left, additions on the right.
 */
@Component({
  selector: 'fs-code-view',
  template: '',
  styleUrl: './code-view.scss'
})
export class CodeView {
  public readonly doc = input.required<string>();
  public readonly language = input.required<CodeLanguage>();
  public readonly label = input.required<string>();
  public readonly original = input<string | undefined>(undefined);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly languageSlot = new Compartment();
  /** The editor showing `doc`; inside `merge` when there is an original. */
  private view: EditorView | undefined;
  private merge: MergeView | undefined;

  public constructor() {
    afterNextRender((): void => {
      this.createView(this.doc(), this.language(), this.original());
    });

    effect((): void => {
      this.syncView(this.doc(), this.language(), this.original());
    });

    inject(DestroyRef).onDestroy((): void => {
      this.destroyView();
    });
  }

  private editorExtensions(label: string, language: CodeLanguage): Extension[] {
    const attributes = { 'aria-label': label, 'aria-readonly': 'true' };

    return [
      basicSetup,
      syntaxHighlighting(classHighlighter),
      EditorState.readOnly.of(true),
      EditorView.contentAttributes.of(attributes),
      this.languageSlot.of(languageExtension(language))
    ];
  }

  private createView(doc: string, language: CodeLanguage, original: string | undefined): void {
    const parent = this.host.nativeElement;
    const extensions = this.editorExtensions(this.label(), language);

    if (original === undefined) {
      const state = EditorState.create({ doc, extensions });

      this.view = new EditorView({ state, parent });

      return;
    }

    const originalExtensions = this.editorExtensions(`Existing ${this.label()}`, language);

    const a = { doc: original, extensions: originalExtensions };
    const b = { doc, extensions };

    this.merge = new MergeView({ a, b, parent, diffConfig: DIFF_CONFIG });
    this.view = this.merge.b;
  }

  private destroyView(): void {
    const root = this.merge ?? this.view;

    root?.destroy();
    this.merge = undefined;
    this.view = undefined;
  }

  private syncView(doc: string, language: CodeLanguage, original: string | undefined): void {
    if (this.view === undefined) return;

    const isMerge = this.merge !== undefined;
    const needsMerge = original !== undefined;

    // One view cannot switch between a single editor and a side-by-side pair, so rebuild.
    if (isMerge !== needsMerge) {
      this.destroyView();
      this.createView(doc, language, original);

      return;
    }

    const languageEffect = this.languageSlot.reconfigure(languageExtension(language));

    syncEditor(this.view, doc, languageEffect);

    if (this.merge !== undefined && original !== undefined) syncEditor(this.merge.a, original, languageEffect);
  }
}
